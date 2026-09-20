// CSKH Console — trang "Hộp thư CSKH" (hàng chờ hội thoại Zalo OA với KHÁCH HÀNG, khác nghiệp
// vụ NCC Hub — mua vào). Port pattern 1:1 từ src/features/chats-ncc/index.tsx (NCC Hub) —
// KHÔNG viết lại luồng gọi API/ChatWindow từ đầu, chỉ đổi endpoint + field theo backend
// ZALO-CSKH (routes/queue.js). Bỏ 2 tính năng riêng của NCC Hub không có ở CSKH: AI Suggested
// Reply và panel "Trí nhớ công ty" — trang này ASSIST-only tuyệt đối (không có nhánh AI/tự động
// nào cả, mọi tin gửi ra LUÔN là người thật bấm Gửi, đúng D-003/D-006).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChatWindow,
  MessageBubble,
  type ConversationAction,
  type ConversationMessage,
  type ConversationSummary,
} from '@tmg/conversation-ui'
import { nccApi } from '@/lib/ncc-api'
import { apiCall } from '@/lib/api-envelope'
import { SidebarTrigger } from '@/components/ui/sidebar'
// Thứ tự import CSS QUAN TRỌNG — override phải nạp SAU styles.css gốc của package (đúng thứ tự
// đã dùng ở chats-ncc/index.tsx, NCC Hub).
import '@tmg/conversation-ui/styles.css'
import './cskh-inbox.css'

const MESSAGE_POLL_MS = 15000
const QUEUE_POLL_MS = 20000

// SQLite datetime('now') trả "YYYY-MM-DD HH:MM:SS" UTC KHÔNG hậu tố — cùng gotcha đã ghi ở
// chats-ncc/index.tsx (NCC Hub CLAUDE.md #6). Hiển thị thẳng chuỗi thô sẽ sai giờ 7 tiếng.
function formatTimestamp(ts: string): string {
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return ts
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// Khớp schema oa_conversation (ZALO-CSKH db.js).
interface ConversationRow {
  id: number
  zalo_user_id: string
  display_name: string
  phone_hint: string
  status: 'bot' | 'queued' | 'assigned' | 'resolved'
  assigned_to: string
  created_at: string
  updated_at: string
  last_message_at: string
}

// Khớp schema oa_message (ZALO-CSKH db.js).
interface MessageRow {
  id: number
  conversation_id: number
  direction: 'in' | 'out'
  kind: string
  text: string
  sent_by: string
  ts: string
}

const STATUS_LABEL: Record<ConversationRow['status'], string> = {
  bot: 'Bot đang tự tra cứu',
  queued: 'Chờ nhận',
  assigned: 'Đang xử lý',
  resolved: 'Đã đóng',
}

function conversationName(row: ConversationRow): string {
  return row.display_name?.trim() || row.zalo_user_id
}

function toConversationMessage(row: MessageRow): ConversationMessage {
  return {
    id: String(row.id),
    direction: row.direction === 'out' ? 'outgoing' : 'incoming',
    sender: { id: row.sent_by || String(row.id), name: row.sent_by || 'Khách' },
    text: row.text,
    timestamp: formatTimestamp(row.ts),
    variant: row.kind === 'system' ? 'system' : 'standard',
  }
}

export function CskhInboxPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ConversationRow | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const selectedRef = useRef<ConversationRow | null>(null)
  selectedRef.current = selected

  const loadQueue = useCallback(async (showLoading: boolean) => {
    if (showLoading) setListLoading(true)
    try {
      const payload = await apiCall(nccApi.get('/queue'))
      const rows = Array.isArray(payload.conversations) ? (payload.conversations as ConversationRow[]) : []
      setConversations(rows)
      setListError(null)
      // Đồng bộ lại hội thoại đang chọn (status/last_message_at có thể vừa đổi do người khác nhận việc).
      if (selectedRef.current) {
        const fresh = rows.find((r) => r.id === selectedRef.current!.id)
        if (fresh) setSelected(fresh)
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Không tải được hàng chờ hội thoại')
    } finally {
      if (showLoading) setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue(true)
    const timer = window.setInterval(() => void loadQueue(false), QUEUE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [loadQueue])

  const loadMessages = useCallback(async (conv: ConversationRow, showLoading: boolean) => {
    if (showLoading) {
      setLoading(true)
      setMessageError(null)
    }
    try {
      const payload = await apiCall(nccApi.get(`/queue/${conv.id}/messages`))
      const rows = Array.isArray(payload.messages) ? (payload.messages as MessageRow[]) : []
      if (selectedRef.current?.id !== conv.id) return
      setMessages(rows.map(toConversationMessage))
      setMessageError(null)
    } catch (error) {
      if (selectedRef.current?.id !== conv.id) return
      setMessages([])
      setMessageError(error instanceof Error ? error.message : 'Không tải được hội thoại')
    } finally {
      if (selectedRef.current?.id === conv.id) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    setDraft('')
    setSendError(null)
    setActionError(null)
    void loadMessages(selected, true)
    const timer = window.setInterval(() => {
      void loadMessages(selectedRef.current as ConversationRow, false)
    }, MESSAGE_POLL_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMessages, selected?.id])

  const assignToMe = async () => {
    if (!selected) return
    setActionBusy(true)
    setActionError(null)
    try {
      await apiCall(nccApi.post(`/queue/${selected.id}/assign`, {}))
      await loadQueue(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không nhận được việc')
    } finally {
      setActionBusy(false)
    }
  }

  const resolveConversation = async () => {
    if (!selected) return
    setActionBusy(true)
    setActionError(null)
    try {
      await apiCall(nccApi.post(`/queue/${selected.id}/resolve`, {}))
      await loadQueue(false)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không đóng được hội thoại')
    } finally {
      setActionBusy(false)
    }
  }

  const submitMessage = async (value: string) => {
    if (!selected) return
    setSending(true)
    setSendError(null)
    try {
      const payload = await apiCall(nccApi.post(`/queue/${selected.id}/reply`, { text: value }))
      setDraft('')
      // routes/queue.js hiện chỉ ghi log, chưa gửi thật ra Zalo OA (chờ port OA sender) —
      // backend trả `warning` cho case này, hiện thẳng cho người dùng biết, không giả vờ đã gửi.
      if (typeof payload.warning === 'string') setSendError(payload.warning)
      await loadMessages(selected, false)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Không gửi được tin nhắn')
    } finally {
      setSending(false)
    }
  }

  const conversation = useMemo<ConversationSummary | undefined>(() => {
    if (!selected) return undefined
    return {
      id: String(selected.id),
      title: conversationName(selected),
      subtitle: selected.phone_hint || `Zalo ${selected.zalo_user_id}`,
      statusText: `${STATUS_LABEL[selected.status]} · ${formatTimestamp(selected.last_message_at)}`,
    }
  }, [selected])

  // ASSIST-only tuyệt đối (D-003/D-006) — CHỈ 2 thao tác con người, KHÔNG có nút "AI tự gửi"/
  // auto-reply nào ở trang này (đúng yêu cầu B trong việc cần làm).
  const headerActions = useMemo<ConversationAction[]>(() => {
    if (!selected) return []
    const canAssign = selected.status === 'queued' || selected.status === 'bot'
    const canResolve = selected.status !== 'resolved'
    return [
      {
        id: 'assign',
        label: actionBusy ? 'Đang xử lý…' : 'Nhận việc',
        disabled: actionBusy || !canAssign,
        onSelect: assignToMe,
      },
      {
        id: 'resolve',
        label: actionBusy ? 'Đang xử lý…' : 'Đóng',
        disabled: actionBusy || !canResolve,
        onSelect: resolveConversation,
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, actionBusy])

  const renderMessage = (message: ConversationMessage) => <MessageBubble message={message} />

  return (
    // Full-bleed (giống chats-ncc/index.tsx NCC Hub) — hộp thư 2 cột cần lấp đầy viewport, không
    // ngồi trong khung padded như dashboard. KHÔNG dùng <Header>/<Main> ở đây; AppSidebar vẫn
    // hiển thị nguyên (sibling do AuthenticatedLayout render) — chỉ thêm SidebarTrigger để còn
    // mở lại sidebar trên mobile.
    <main data-layout='fixed' className='flex grow flex-col overflow-hidden'>
      <div className='workspace'>
        <aside className='workspace-sidebar'>
          <section className='workspace-search'>
            <div className='flex items-center gap-2'>
              <SidebarTrigger variant='outline' />
              <h1 className='workspace-title !mb-0'>Hộp thư CSKH</h1>
            </div>
          </section>
          {listError && <div className='workspace-error'>{listError}</div>}
          <div className='workspace-results'>
            {listLoading && conversations.length === 0 && (
              <p className='workspace-note'>Đang tải hàng chờ…</p>
            )}
            {!listLoading && !listError && conversations.length === 0 && (
              <p className='workspace-note'>Không có hội thoại nào đang chờ hoặc đang xử lý.</p>
            )}
            {conversations.map((conv) => (
              <button
                className={`workspace-result${selected?.id === conv.id ? ' is-selected' : ''}`}
                key={conv.id}
                onClick={() => setSelected(conv)}
                type='button'
              >
                <strong>{conversationName(conv)}</strong>
                <span
                  className={`workspace-result-status workspace-result-status--${conv.status === 'assigned' ? 'assigned' : 'queued'}`}
                >
                  {STATUS_LABEL[conv.status]}
                </span>
                <span>{formatTimestamp(conv.last_message_at)}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className='workspace-main'>
          {selected ? (
            <>
              <ChatWindow
                className='workspace-chat'
                conversation={conversation}
                emptyState={messageError ? undefined : 'Chưa có tin nhắn trong 7 ngày qua'}
                headerActions={headerActions}
                loading={loading}
                messages={messages}
                renderMessage={renderMessage}
                composerProps={{
                  value: draft,
                  onChange: setDraft,
                  onSubmit: submitMessage,
                  disabled: !selected || selected.status === 'resolved',
                  sending,
                  placeholder:
                    selected.status === 'resolved'
                      ? 'Hội thoại đã đóng — không thể gửi thêm'
                      : 'Nhập tin nhắn gửi khách…',
                }}
              />
              {messageError && <div className='workspace-send-error'>{messageError}</div>}
              {sendError && <div className='workspace-send-error'>{sendError}</div>}
              {actionError && <div className='workspace-send-error'>{actionError}</div>}
              <p className='workspace-status'>
                Tự cập nhật mỗi 15 giây · mọi tin gửi ra LUÔN do người thật bấm Gửi (không có
                nút AI tự gửi/auto-reply ở trang này)
              </p>
            </>
          ) : (
            <div className='workspace-empty'>
              Chọn một hội thoại ở danh sách bên trái để xem lịch sử và trả lời khách.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
