/// <reference lib="es2022.error" />
// Chỉ file này cần type `Error(message, { cause })` (ES2022) — tsconfig.app.json chung của repo
// đang target ES2020/lib ES2020 (không đổi, nhiều route khác phụ thuộc); triple-slash reference
// nạp thêm đúng 1 lib.d.ts cho riêng file này, không đổi target/lib toàn project.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  ChatWindow,
  MessageBubble,
  type ConversationAction,
  type ConversationMessage,
  type ConversationSummary,
} from '@tmg/conversation-ui'
import { nccApi } from '@/lib/ncc-api'
import { SidebarTrigger } from '@/components/ui/sidebar'
// Thứ tự import CSS QUAN TRỌNG — override phải nạp SAU styles.css gốc của package, không thì
// mất tác dụng (đúng thứ tự đã dùng ở workspace-ui cũ, src/main.tsx).
import '@tmg/conversation-ui/styles.css'
import './zalo-ops-override.css'

// NCC Hub v3 — port THẬT từ ZALO-INTEGRATION/admin/workspace-ui/src/App.tsx (workspace-ui cũ,
// đang bị retire). Giữ nguyên toàn bộ state/effect/luồng nghiệp vụ — CHỈ đổi tầng gọi API
// (requestJson/fetch → nccApi/axios, xem apiCall() dưới) và tầng layout (full-bleed riêng, không
// dùng Header/Main của shell — xem ChatsPage() cuối file).

interface SearchRow {
  id: number
  group_id: string
  group_name: string
  sender: string
  text: string
  kind: string
  is_self: number
  ts: string
  ma_ncc: string | null
  ten_ncc: string | null
}

interface MessageRow {
  id: number
  sender: string
  text: string
  kind: string
  is_self: number
  ts: string
  attribution?: { source: string; actor_email?: string; drafted_at?: string; edited?: boolean }
  image_url?: string // TASK-C2 (Phase 2, D-024) — chỉ URL, KHÔNG có OCR/xử lý gì thêm ở FE
}

interface GroupOption {
  group_id: string
  group_name: string
  ten_ncc: string | null
  last_ts: string
}

// TASK-C3 Zalo Local Companion (Phase 2, D-024) — "trí nhớ công ty" người tự ghi, KHÔNG phải AI
// tự động quét/suy luận. Category CHỐT 19/09 chỉ 2 loại — khớp whitelist backend routes/memory.js.
interface MemoryEntry {
  id: number
  category: 'contact' | 'agreement'
  subject: string
  content: string
  created_by: string
  created_at: string
}

// TASK-C2 OCR (Phase 2, D-024) — trích số liệu từ ảnh NCC gửi qua z vision. Confidence model tự
// chấm KHÔNG đáng tin (đo thật: 0.98-0.99 đều tăm tắp) — không có nhánh auto-approve, người xác
// nhận LUÔN sửa được giá trị trước khi lưu (human-in-loop thật, không phải nút duyệt suông).
interface OcrField {
  field: string
  value: string
  confidence?: number
}
interface OcrState {
  status: 'idle' | 'loading' | 'review' | 'error'
  captureId?: number
  fields?: OcrField[]
  error?: string
}

const SEARCH_DEBOUNCE_MS = 350
const MESSAGE_POLL_MS = 15000
const PAGE_SIZE = 80

// Envelope chung mọi route admin/routes/*.js trả về — BẤT BIẾN: nhiều route trả `ok:false` kèm
// HTTP 200 (ví dụ /api/chat-send khi gateway gửi lỗi, /api/inbound khi skip) — axios KHÔNG tự
// throw cho case này (chỉ throw khi status ngoài 2xx). apiCall() dưới bù đúng phần requestJson()
// cũ (fetch) đã làm: `!response.ok || payload?.ok === false` → throw. Giữ để không lặng lẽ coi
// "gửi lỗi" thành "gửi xong" khi port sang axios.
interface ApiEnvelope {
  ok?: boolean
  error?: string
  [key: string]: unknown
}

async function apiCall<T extends ApiEnvelope>(
  promise: Promise<{ data: T }>
): Promise<T> {
  try {
    const { data } = await promise
    if (data?.ok === false) {
      throw new Error(data.error || 'API trả lỗi')
    }
    return data
  } catch (error) {
    // Search effect dưới cần phân biệt "bị huỷ do đổi từ khoá" với lỗi thật — giữ nguyên error
    // gốc để axios.isCancel() ở nơi gọi nhận diện được (bọc thành Error thường sẽ mất dấu này).
    if (axios.isCancel(error)) throw error
    if (axios.isAxiosError<ApiEnvelope>(error)) {
      const detail = error.response?.data?.error
      throw new Error(
        detail || (error.response ? `HTTP ${error.response.status}` : error.message),
        { cause: error }
      )
    }
    throw error
  }
}

// CLAUDE.md gotcha #6: SQLite datetime('now') trả "YYYY-MM-DD HH:MM:SS" UTC KHÔNG hậu tố.
// Hiển thị thẳng chuỗi thô từng làm giờ tin nhắn sai 7 tiếng — luôn qua new Date(...+'Z') trước.
function formatTimestamp(ts: string): string {
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return ts
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function toConversationMessage(row: MessageRow): ConversationMessage {
  return {
    id: String(row.id),
    direction: row.is_self ? 'outgoing' : 'incoming',
    sender: { id: row.sender || String(row.id), name: row.sender || 'Không rõ' },
    text: row.text,
    timestamp: formatTimestamp(row.ts),
    variant: row.kind === 'system' ? 'system' : 'standard',
    // TASK-C2 (Phase 2, D-024) — NCC gửi ảnh giờ hiện thật thay vì mất tích. Package đã sẵn
    // MediaRenderer qua field `media` (TASK-0 #11 không cho sửa MessageBubble — không cần, field
    // này đã tồn tại sẵn trong types.ts gốc).
    media: row.image_url
      ? [{ id: `${row.id}-img`, kind: 'image', src: row.image_url, thumbnailSrc: row.image_url, alt: 'Ảnh từ NCC' }]
      : undefined,
    // TASK-B2 (05_SPEC Mục 2.5 #9/#11) — audit-trail provenance, KHÔNG phải badge loè loẹt
    // trên bubble (Mục 5.2); AC#3 thoả mãn qua title/tooltip nhẹ, xem renderMessage dưới.
    attribution: row.attribution
      ? {
          source:
            row.attribution.source === 'ai_suggested_sent_by_human'
              ? 'ai_draft'
              : row.attribution.source === 'system'
                ? 'system'
                : 'human',
          actorEmail: row.attribution.actor_email,
          draftedAt: row.attribution.drafted_at,
        }
      : undefined,
  }
}

export function ChatsPage() {
  const [term, setTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupOption | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attributionWarning, setAttributionWarning] = useState<string | null>(null)
  // AI Suggested Reply (TASK-B2) — draftSuggestion state riêng khỏi `draft` (giá trị composer):
  // suggestion_ready hiện banner phía trên; Chèn mới copy sang `draft`. aiOriginRef giữ nguyên
  // văn bản draft gốc để BACKEND tự tính "edited" (so lệch với text lúc Gửi) — không tự tính ở FE.
  const [draftSuggestion, setDraftSuggestion] = useState<string | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftGenError, setDraftGenError] = useState<string | null>(null)
  const aiOriginRef = useRef<string | null>(null) // != null → tin đang soạn xuất phát từ AI draft
  const selectedRef = useRef<GroupOption | null>(null)
  // TASK-C3 — panel "Trí nhớ công ty", đóng mặc định (không tự phơi thông tin về người khác ra
  // ngay khi mở group — phải chủ động bấm xem, giống tinh thần ASSIST-only/không tự động).
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([])
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [memoryCategory, setMemoryCategory] = useState<'contact' | 'agreement'>('contact')
  const [memorySubject, setMemorySubject] = useState('')
  const [memoryContent, setMemoryContent] = useState('')
  const [memorySaving, setMemorySaving] = useState(false)
  // TASK-C2 — 1 trạng thái OCR riêng cho MỖI tin ảnh (key = message.id), không phải state chung
  // toàn conversation như draft/memory — vì OCR gắn với 1 tin cụ thể, có thể trích nhiều ảnh cùng lúc.
  const [ocrState, setOcrState] = useState<Record<string, OcrState>>({})

  selectedRef.current = selectedGroup

  useEffect(() => {
    const query = term.trim()
    if (query.length < 2) {
      setGroups([])
      setSearchError(null)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const payload = await apiCall(
          nccApi.get('/search', { params: { q: query }, signal: controller.signal })
        )
        const rows = Array.isArray(payload.results) ? (payload.results as SearchRow[]) : []
        const grouped = new Map<string, GroupOption>()
        for (const row of rows) {
          const existing = grouped.get(row.group_id)
          if (!existing || row.ts > existing.last_ts) {
            grouped.set(row.group_id, {
              group_id: row.group_id,
              group_name: row.group_name,
              ten_ncc: row.ten_ncc,
              last_ts: row.ts,
            })
          }
        }
        setGroups([...grouped.values()].sort((a, b) => b.last_ts.localeCompare(a.last_ts)))
      } catch (error) {
        if (!axios.isCancel(error)) {
          setGroups([])
          setSearchError(error instanceof Error ? error.message : 'Không tìm được dữ liệu')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [term])

  const loadMessages = useCallback(async (group: GroupOption, showLoading: boolean) => {
    if (showLoading) {
      setLoading(true)
      setMessageError(null)
    }
    try {
      const payload = await apiCall(nccApi.get(`/messages/${encodeURIComponent(group.group_id)}`))
      const rows = Array.isArray(payload.messages) ? (payload.messages as MessageRow[]) : []
      if (selectedRef.current?.group_id !== group.group_id) return
      setMessages(rows.map(toConversationMessage))
      setMessageError(null)
    } catch (error) {
      if (selectedRef.current?.group_id !== group.group_id) return
      setMessages([])
      setMessageError(error instanceof Error ? error.message : 'Không tải được hội thoại')
    } finally {
      if (selectedRef.current?.group_id === group.group_id) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedGroup) return
    setVisibleCount(PAGE_SIZE)
    setDraft('')
    setSendError(null)
    setAttributionWarning(null)
    setDraftSuggestion(null)
    setDraftGenError(null)
    aiOriginRef.current = null
    setMemoryOpen(false) // đóng lại khi đổi group — phải chủ động mở lại, không rò "trí nhớ" nhóm cũ
    setMemoryEntries([])
    setMemoryError(null)
    setOcrState({}) // reset panel OCR đang review — tránh lẫn giữa nhóm cũ/mới
    void loadMessages(selectedGroup, true)
    const timer = window.setInterval(() => {
      void loadMessages(selectedRef.current as GroupOption, false)
    }, MESSAGE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [loadMessages, selectedGroup])

  const loadMemory = useCallback(async (group: GroupOption) => {
    setMemoryLoading(true)
    setMemoryError(null)
    try {
      const payload = await apiCall(
        nccApi.get(`/company-memory/${encodeURIComponent(group.group_id)}`)
      )
      if (selectedRef.current?.group_id !== group.group_id) return
      setMemoryEntries(Array.isArray(payload.entries) ? (payload.entries as MemoryEntry[]) : [])
    } catch (error) {
      if (selectedRef.current?.group_id !== group.group_id) return
      setMemoryError(error instanceof Error ? error.message : 'Không tải được trí nhớ công ty')
    } finally {
      if (selectedRef.current?.group_id === group.group_id) setMemoryLoading(false)
    }
  }, [])

  const toggleMemory = () => {
    const next = !memoryOpen
    setMemoryOpen(next)
    if (next && selectedGroup) void loadMemory(selectedGroup)
  }

  const submitMemory = async () => {
    if (!selectedGroup || !memoryContent.trim()) return
    setMemorySaving(true)
    setMemoryError(null)
    try {
      await apiCall(
        nccApi.post('/company-memory', {
          group_id: selectedGroup.group_id,
          category: memoryCategory,
          subject: memorySubject,
          content: memoryContent,
        })
      )
      setMemorySubject('')
      setMemoryContent('')
      await loadMemory(selectedGroup)
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : 'Không lưu được')
    } finally {
      setMemorySaving(false)
    }
  }

  const deleteMemory = async (id: number) => {
    if (!selectedGroup) return
    try {
      await apiCall(nccApi.delete(`/company-memory/${id}`))
      await loadMemory(selectedGroup)
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : 'Không xoá được')
    }
  }

  // TASK-C2 (Phase 2, D-024) — trigger OCR cho 1 tin ảnh cụ thể. Tốn quota z THẬT mỗi lần bấm —
  // không tự động gọi khi tin ảnh xuất hiện, phải người bấm chủ động.
  const triggerOcr = async (messageId: string) => {
    setOcrState((prev) => ({ ...prev, [messageId]: { status: 'loading' } }))
    try {
      const payload = await apiCall(
        nccApi.post('/ocr-capture', { message_id: Number(messageId) })
      )
      setOcrState((prev) => ({
        ...prev,
        [messageId]: {
          status: 'review',
          captureId: payload.id as number,
          fields: (payload.extracted_fields as OcrField[]) || [],
        },
      }))
    } catch (error) {
      setOcrState((prev) => ({
        ...prev,
        [messageId]: { status: 'error', error: error instanceof Error ? error.message : 'Không trích được' },
      }))
    }
  }

  const editOcrField = (messageId: string, idx: number, value: string) => {
    setOcrState((prev) => {
      const current = prev[messageId]
      if (!current?.fields) return prev
      const fields = current.fields.map((f, i) => (i === idx ? { ...f, value } : f))
      return { ...prev, [messageId]: { ...current, fields } }
    })
  }

  // Human-in-loop THẬT — người xác nhận gửi lại giá trị (có thể đã sửa tay), không chỉ bấm "OK" suông.
  const confirmOcr = async (messageId: string) => {
    const state = ocrState[messageId]
    if (!state?.captureId) return
    try {
      await apiCall(
        nccApi.post(`/ocr-capture/${state.captureId}/confirm`, { extracted_fields: state.fields })
      )
      setOcrState((prev) => ({ ...prev, [messageId]: { status: 'idle' } }))
    } catch (error) {
      setOcrState((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          status: 'error',
          error: error instanceof Error ? error.message : 'Không xác nhận được',
        },
      }))
    }
  }

  const rejectOcr = async (messageId: string) => {
    const state = ocrState[messageId]
    if (!state?.captureId) return
    try {
      await apiCall(nccApi.post(`/ocr-capture/${state.captureId}/reject`))
    } catch {
      /* dù API lỗi vẫn cho đóng panel — reject không cần chắc chắn như confirm */
    }
    setOcrState((prev) => ({ ...prev, [messageId]: { status: 'idle' } }))
  }

  // AI Suggested Reply — ASSIST-only (D-003/D-006): CHỈ sinh draft, KHÔNG tự chèn/gửi. Context
  // gửi kèm = đúng 20 tin gần nhất của group ĐANG MỞ (TASK-0 #8) — không tự suy luận/gộp group khác.
  const requestDraft = async () => {
    if (!selectedGroup) return
    const requestedGroupId = selectedGroup.group_id // chụp lại — race-guard bên dưới
    setDraftLoading(true)
    setDraftGenError(null)
    setDraftSuggestion(null)
    try {
      const history = messages.slice(-20).map((m) => ({ text: m.text || '', is_self: m.direction === 'outgoing' }))
      const payload = await apiCall(
        nccApi.post('/ai-draft', { group_id: requestedGroupId, messages: history })
      )
      // Race condition (05_SPEC — cx challenge finding #11): người đã chuyển group khác trong
      // lúc chờ → HUỶ, không hiện gợi ý sai group.
      if (selectedRef.current?.group_id !== requestedGroupId) return
      const text = typeof payload.draft_text === 'string' ? payload.draft_text : ''
      if (!text) {
        setDraftGenError('AI không đủ ngữ cảnh để gợi ý — soạn tay giúp em.')
      } else {
        setDraftSuggestion(text)
      }
    } catch (error) {
      if (selectedRef.current?.group_id !== requestedGroupId) return
      setDraftGenError(error instanceof Error ? error.message : 'Không sinh được gợi ý AI')
    } finally {
      if (selectedRef.current?.group_id === requestedGroupId) setDraftLoading(false)
    }
  }

  const acceptDraft = () => {
    if (!draftSuggestion) return
    setDraft(draftSuggestion)
    aiOriginRef.current = draftSuggestion // giữ bản GỐC để backend tự so lệch tính "edited"
    setDraftSuggestion(null)
  }

  const dismissDraft = () => {
    setDraftSuggestion(null)
    setDraftGenError(null)
  }

  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - visibleCount)),
    [messages, visibleCount]
  )

  const conversation = useMemo<ConversationSummary | undefined>(() => {
    if (!selectedGroup) return undefined
    return {
      id: selectedGroup.group_id,
      title: selectedGroup.ten_ncc || selectedGroup.group_name,
      subtitle: selectedGroup.ten_ncc ? selectedGroup.group_name : `Group ${selectedGroup.group_id}`,
      statusText: formatTimestamp(selectedGroup.last_ts),
    }
  }, [selectedGroup])

  const headerActions = useMemo<ConversationAction[]>(
    () => [
      {
        id: 'ai-draft',
        label: draftLoading ? 'Đang soạn gợi ý…' : '✨ Gợi ý AI',
        disabled: draftLoading || messages.length === 0,
        onSelect: requestDraft,
      },
      {
        id: 'company-memory',
        label: memoryOpen ? '🧠 Đóng trí nhớ' : '🧠 Trí nhớ công ty',
        disabled: false,
        onSelect: toggleMemory,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftLoading, messages, selectedGroup, memoryOpen]
  )

  // Attribution (AC#3) — KHÔNG badge loè loẹt trên bubble, chỉ 1 dòng nhỏ dưới bubble khi tin
  // là AI-draft-người-gửi (05_SPEC Mục 2.5 #9/Mục 5.2). MessageBubble gốc chưa biết field này
  // (mới thêm ở types.ts, TASK-0 #11 chỉ cho phép sửa types.ts/Composer.tsx, không phải
  // MessageBubble.tsx) — dùng renderMessage của ChatWindow để bọc thêm, không sửa package thêm.
  const renderMessage = (message: ConversationMessage) => {
    const ocr = ocrState[message.id]
    return (
      // display:contents — KHÔNG tạo box layout riêng, để <article class="tmg-cui-message--..."> từ
      // MessageBubble (bên trong) vẫn là con trực tiếp của flex container .tmg-cui-chat__message-list
      // như package gốc mong đợi (align-self trái/phải theo direction) — bọc div thường sẽ VỠ layout.
      <div style={{ display: 'contents' }}>
        <MessageBubble message={message} />
        {message.attribution?.source === 'ai_draft' && (
          <div
            className={`workspace-attribution workspace-attribution--${message.direction}`}
            title={
              message.attribution.draftedAt
                ? `Soạn AI lúc ${message.attribution.draftedAt}`
                : 'Soạn bằng AI, người gửi'
            }
          >
            🤖 AI hỗ trợ soạn — {message.attribution.actorEmail || 'người dùng'} đã gửi
          </div>
        )}
        {/* TASK-C2 — chỉ tin có ảnh (media) mới hiện nút OCR; tốn quota z THẬT nên phải người bấm chủ động, không tự chạy. */}
        {message.media && message.media.length > 0 && (!ocr || ocr.status === 'idle') && (
          <button
            className={`workspace-ocr-trigger workspace-ocr-trigger--${message.direction}`}
            onClick={() => void triggerOcr(message.id)}
            type='button'
          >
            🔍 Trích số liệu
          </button>
        )}
        {ocr?.status === 'loading' && (
          <div className={`workspace-ocr-trigger workspace-ocr-trigger--${message.direction}`}>
            Đang trích số liệu…
          </div>
        )}
        {ocr?.status === 'error' && (
          <div className={`workspace-ocr-review workspace-ocr-review--${message.direction}`}>
            <span className='workspace-ocr-review__error'>{ocr.error}</span>
            <button onClick={() => void triggerOcr(message.id)} type='button'>
              Thử lại
            </button>
          </div>
        )}
        {ocr?.status === 'review' && (
          <div className={`workspace-ocr-review workspace-ocr-review--${message.direction}`}>
            <p className='workspace-note'>Kết quả z vision (KHÔNG tự tin — sửa lại trước khi xác nhận):</p>
            {(ocr.fields || []).length === 0 && <p className='workspace-note'>Không tìm thấy số liệu rõ ràng trong ảnh.</p>}
            {(ocr.fields || []).map((f, idx) => (
              <div className='workspace-ocr-review__field' key={idx}>
                <span className='workspace-ocr-review__label'>{f.field}</span>
                <input value={f.value} onChange={(e) => editOcrField(message.id, idx, e.target.value)} type='text' />
              </div>
            ))}
            <div className='workspace-ocr-review__actions'>
              <button onClick={() => void confirmOcr(message.id)} type='button'>
                ✅ Xác nhận
              </button>
              <button onClick={() => void rejectOcr(message.id)} type='button'>
                Bỏ
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const submitMessage = async (value: string) => {
    if (!selectedGroup) return
    setSending(true)
    setSendError(null)
    setAttributionWarning(null)
    const aiAssisted = aiOriginRef.current != null
    const originalDraft = aiOriginRef.current
    try {
      const payload = await apiCall(
        nccApi.post('/chat-send', {
          group_id: selectedGroup.group_id,
          text: value,
          ...(aiAssisted ? { ai_assisted: true, draft_text: originalDraft } : {}),
        })
      )
      setDraft('')
      aiOriginRef.current = null
      if (typeof payload.attribution_warning === 'string') setAttributionWarning(payload.attribution_warning)
      await loadMessages(selectedGroup, false)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Không gửi được tin nhắn')
    } finally {
      setSending(false)
    }
  }

  return (
    // Full-bleed (TASK-0 quyết định port) — workspace hội thoại 2 cột cần lấp đầy viewport, không
    // ngồi trong khung padded như dashboard/orders. data-layout="fixed" là cùng cơ chế Main{fixed}
    // dùng (xem src/components/layout/main.tsx) để SidebarInset cha tự tính chiều cao h-svh —
    // KHÔNG dùng <Header>/<Main> ở đây, nhưng AppSidebar vẫn hiển thị nguyên (nó là sibling do
    // AuthenticatedLayout render, không phải con của route) — chỉ thêm SidebarTrigger gọn để còn
    // mở lại sidebar trên mobile (ở đó sidebar là Sheet off-canvas, không có cách mở nào khác).
    <main data-layout='fixed' className='flex grow flex-col overflow-hidden'>
      <div className='workspace'>
        <aside className='workspace-sidebar'>
          <section className='workspace-search'>
            <div className='mb-2.5 flex items-center gap-2'>
              <SidebarTrigger variant='outline' />
              <h1 className='workspace-title !mb-0'>Conversation Workspace</h1>
            </div>
            <form
              className='workspace-search-form'
              onSubmit={(event) => {
                event.preventDefault()
              }}
            >
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder='Tìm nhóm, NCC hoặc tin nhắn'
                type='search'
              />
              <button disabled={searching} type='submit'>
                {searching ? 'Đang tìm' : 'Tìm'}
              </button>
            </form>
          </section>
          {searchError && <div className='workspace-error'>{searchError}</div>}
          <div className='workspace-results'>
            {groups.map((group) => (
              <button
                className={`workspace-result${selectedGroup?.group_id === group.group_id ? ' is-selected' : ''}`}
                key={group.group_id}
                onClick={() => setSelectedGroup(group)}
                type='button'
              >
                <strong>{group.ten_ncc || group.group_name}</strong>
                <span>{group.group_name}</span>
                <span>{formatTimestamp(group.last_ts)}</span>
              </button>
            ))}
            {term.trim().length >= 2 && !searching && !searchError && groups.length === 0 && (
              <p className='workspace-note'>Không có kết quả trong phạm vi phòng ban.</p>
            )}
            {term.trim().length < 2 && (
              <p className='workspace-note'>
                Nhập tối thiểu 2 ký tự để tìm hội thoại. Hệ thống chỉ hiển thị kết quả backend cho
                phép theo phòng ban.
              </p>
            )}
          </div>
        </aside>
        <section className='workspace-main'>
          {searchError && !selectedGroup ? (
            <div className='workspace-error'>{searchError}</div>
          ) : selectedGroup ? (
            <>
              <ChatWindow
                className='workspace-chat'
                conversation={conversation}
                emptyState={messageError ? undefined : 'Chưa có tin nhắn trong 7 ngày qua'}
                hasOlderMessages={visibleCount < messages.length}
                headerActions={headerActions}
                loading={loading}
                loadingOlder={false}
                messages={visibleMessages}
                onLoadOlder={() => setVisibleCount((count) => count + PAGE_SIZE)}
                renderMessage={renderMessage}
                composerProps={{
                  value: draft,
                  onChange: setDraft,
                  onSubmit: submitMessage,
                  disabled: !selectedGroup,
                  sending,
                  placeholder: 'Nhập tin nhắn gửi nhóm NCC...',
                  draftSuggestion: draftSuggestion || undefined,
                  draftLoading,
                  onAcceptDraft: acceptDraft,
                  onDismissDraft: dismissDraft,
                }}
              />
              {messageError && <div className='workspace-send-error'>{messageError}</div>}
              {sendError && <div className='workspace-send-error'>{sendError}</div>}
              {draftGenError && <div className='workspace-send-error'>{draftGenError}</div>}
              {attributionWarning && <div className='workspace-send-error'>{attributionWarning}</div>}
              {memoryOpen && (
                <section className='workspace-memory'>
                  <h2 className='workspace-memory__title'>
                    🧠 Trí nhớ công ty — {selectedGroup.ten_ncc || selectedGroup.group_name}
                  </h2>
                  <p className='workspace-note'>
                    Do nhân viên tự ghi, KHÔNG phải AI tự quét tin nhắn. Chỉ 2 loại: đầu mối liên hệ
                    thật của nhóm, và thoả thuận/ngoại lệ đã chốt qua chat (không nằm trong hợp đồng).
                  </p>
                  {memoryError && <div className='workspace-send-error'>{memoryError}</div>}
                  {memoryLoading ? (
                    <p className='workspace-note'>Đang tải…</p>
                  ) : memoryEntries.length === 0 ? (
                    <p className='workspace-note'>Chưa có ghi chú nào cho nhóm này.</p>
                  ) : (
                    <ul className='workspace-memory__list'>
                      {memoryEntries.map((entry) => (
                        <li className='workspace-memory__item' key={entry.id}>
                          <span className='workspace-memory__badge'>
                            {entry.category === 'contact' ? 'Đầu mối liên hệ' : 'Thoả thuận'}
                          </span>
                          {entry.subject && <strong>{entry.subject}: </strong>}
                          {entry.content}
                          <span className='workspace-memory__meta'>
                            {' '}
                            — {entry.created_by} · {formatTimestamp(entry.created_at)}
                          </span>
                          <button className='workspace-memory__delete' onClick={() => deleteMemory(entry.id)} type='button'>
                            Xoá
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className='workspace-memory__form'
                    onSubmit={(event) => {
                      event.preventDefault()
                      void submitMemory()
                    }}
                  >
                    <select
                      value={memoryCategory}
                      onChange={(event) => setMemoryCategory(event.target.value as 'contact' | 'agreement')}
                    >
                      <option value='contact'>Đầu mối liên hệ thật</option>
                      <option value='agreement'>Thoả thuận/ngoại lệ đã chốt</option>
                    </select>
                    <input
                      value={memorySubject}
                      onChange={(event) => setMemorySubject(event.target.value)}
                      placeholder='Liên quan tới ai (tuỳ chọn)'
                      type='text'
                    />
                    <textarea
                      value={memoryContent}
                      onChange={(event) => setMemoryContent(event.target.value)}
                      placeholder='Ghi lại nội dung cụ thể…'
                      rows={2}
                    />
                    <button disabled={memorySaving || !memoryContent.trim()} type='submit'>
                      {memorySaving ? 'Đang lưu…' : 'Lưu'}
                    </button>
                  </form>
                </section>
              )}
              <p className='workspace-status'>
                Hiển thị {visibleMessages.length}/{messages.length} tin (API giới hạn 300 tin trong
                7 ngày) · tự cập nhật mỗi 15 giây · AI draft là gợi ý, KHÔNG tự gửi (ASSIST-only)
              </p>
            </>
          ) : (
            <div className='workspace-empty'>
              Tìm và chọn một nhóm Zalo để xem lịch sử hội thoại và dùng gợi ý AI (ASSIST-only —
              AI chỉ soạn, không tự gửi).
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
