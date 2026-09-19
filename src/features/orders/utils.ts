// NCC Hub v3 — Đặt hàng: helper thuần port 1:1 từ admin/public/js/views/orders.js +
// admin/public/js/store.js (canApprove/canActOn/isViewOnly/whyCannotSend/norm). KHÔNG tự
// nghĩ logic mới — đây là hành vi production đang chạy, chỉ đổi "S toàn cục" thành tham số.
import type { NccState } from '@/hooks/use-ncc-state'
import type {
  FailedItem,
  NccRow,
  OrderCategory,
  OrderGroup,
  PendingOrderRow,
  SendLogRow,
  SendQueueRow,
  SentItem,
} from './types'

type Me = NccState['me']

/** chuẩn hóa chuỗi để so sánh/sắp xếp không dấu (kế thừa v1, store.js norm()). */
export function norm(s: string | null | undefined): string {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ── QUYỀN (D-014 + D-015) — port store.js, tham số hoá theo `me` thay vì đọc S toàn cục ── */
export function canApprove(me: Me | undefined): boolean {
  return !!(me && (me.isSuper || me.app_role === 'dept_manager'))
}
export function canActOn(me: Me | undefined, dept?: string): boolean {
  return !!(me && (me.isSuper || (me.dept_id && me.dept_id === (dept || 'SCM'))))
}
export function isViewOnly(me: Me | undefined): boolean {
  return !!(me && me.viewAll && !me.isSuper)
}
export function whyCannotSend(me: Me | undefined, ncc: NccRow | undefined): string {
  if (!canApprove(me)) {
    return `Chỉ quản lý trở lên mới được duyệt/gửi (bạn: ${me?.app_role || 'nhân viên'})`
  }
  if (ncc && !canActOn(me, ncc.dept_id)) {
    return `NCC thuộc phòng ${ncc.dept_id || 'SCM'}, bạn thuộc ${me?.dept_id || '—'}`
  }
  if (ncc && ncc.status !== 'dang_dung') {
    return `NCC đang ở trạng thái "${ncc.status || 'chưa duyệt'}" — chỉ gửi khi đang dùng`
  }
  if (ncc && !ncc.zalo_group_id) {
    return 'NCC chưa gán nhóm Zalo'
  }
  return ''
}

/* ── ngày giao + đơn quá ngày (port delivDate/isStale) ── */
export function delivDate(p: PendingOrderRow): Date | null {
  const m = `${p.title || ''} ${p.message || ''}`.match(
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/
  )
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  return isNaN(d.getTime()) ? null : d
}
export function isStale(p: PendingOrderRow): boolean {
  const d = delivDate(p)
  if (!d) return false
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return d < t
}

/* ── suy nhóm hàng từ tiêu đề/nhom_hang (port inferCat) ── */
export function inferCat(p: PendingOrderRow, ncc: NccRow | undefined): OrderCategory {
  const t = `${p.title || ''} ${ncc?.nhom_hang || ''} ${p.message || ''}`.toUpperCase()
  const has = (...k: string[]) => k.some((x) => t.includes(x))
  if (has('TRỨNG')) return { key: 'trung', name: 'Trứng' }
  if (has('THỊT', 'HEO', 'BÒ', 'XƯƠNG', 'LÒNG', 'GIÒ', 'CHẢ', 'SƯỜN', 'BA RỌI', 'NẠC'))
    return { key: 'thit', name: 'Thịt' }
  if (has('CÁ ', 'TÔM', 'MỰC', 'HẢI SẢN', 'NGHÊU', 'SÒ', 'ỐC', 'CUA'))
    return { key: 'haisan', name: 'Hải sản' }
  if (has('ĐẬU', 'TÀU HỦ', 'TÀU HŨ', 'HỦ CHAY', 'CHAY')) return { key: 'dau', name: 'Đậu / Chay' }
  if (
    has(
      'RAU',
      'CỦ',
      'NẤM',
      'HÀNH',
      'NGÒ',
      'ỚT',
      'TỎI',
      'CHANH',
      'DƯA',
      'KHỔ QUA',
      'BÍ',
      'CẢI',
      'GIÁ',
      'TRÁI',
      'CÀ '
    )
  )
    return { key: 'rau', name: 'Rau củ quả' }
  if (
    has('KHÔ', 'GẠO', 'BÚN', 'NƯỚC', 'SỐT', 'GIA VỊ', 'DẦU', 'ĐƯỜNG', 'MUỐI', 'BÁNH', 'MÌ', 'PHỞ', 'TƯƠNG')
  )
    return { key: 'kho', name: 'Khô / Gia vị' }
  return { key: 'khac', name: 'Khác' }
}

/* ── suy MÃ NHÀ HÀNG từ tiền tố tiêu đề vé Base (port inferStore — CHỈ để lọc/hiển thị,
   KHÔNG đụng RBAC/duyệt-gửi, vẫn tập trung ở SCM). ── */
const STORE_MAP: Record<string, string> = {
  'DN-PMH': 'DN-PMH',
  DNPMH: 'DN-PMH',
  'DN-CLON': 'DN-CLON',
  'DN-CL': 'DN-CLON',
  DNCLON: 'DN-CLON',
  'DD-THISO': 'DD-THISO',
  'DD-TSO': 'DD-THISO',
  DDTHISO: 'DD-THISO',
  'BMF-NTT': 'BMF-NTT',
  BMF: 'BMF-NTT',
  BMY: 'BMF-NTT',
}
const WAREHOUSE = new Set(['GTY', 'TMWH', 'TM', 'DNF'])
const STORE_LABEL: Record<string, string> = {
  'DN-PMH': 'Đông Nguyên PMH',
  'DN-CLON': 'Đông Nguyên Chợ Lớn',
  'DD-THISO': 'DONDON Thiso',
  'BMF-NTT': 'Bún Bò Bà Mỹ NTT',
  __kho: 'Kho / Bếp trung tâm',
  __khac: 'Khác',
}
const STORE_ORDER = ['DN-PMH', 'DN-CLON', 'DD-THISO', 'BMF-NTT', '__kho', '__khac']

export function inferStore(p: PendingOrderRow): string {
  const m = String(p.title || '').match(/^([A-Za-zÀ-ỹ0-9]+(?:-[A-Za-zÀ-ỹ0-9]+)*)_/)
  if (!m) return '__khac'
  const raw = m[1].toUpperCase()
  if (STORE_MAP[raw]) return STORE_MAP[raw]
  if (WAREHOUSE.has(raw)) return '__kho'
  return '__khac'
}
export function storeLabel(k: string): string {
  return STORE_LABEL[k] || k
}
export function sortStoreKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = STORE_ORDER.indexOf(a)
    const ib = STORE_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}

/** NCC gửi được = status='dang_dung' (BẤT BIẾN — không đổi ở đây). */
export function nccActive(n: NccRow | undefined): boolean {
  return !!n && n.status === 'dang_dung'
}
export function nccStatusLabel(s: string | undefined): string {
  return s === 'tam_dung' ? 'Tạm dừng' : s === 'ngung' ? 'Ngưng' : s === 'cho_duyet' ? 'Chờ duyệt' : s || 'Chưa duyệt'
}

function nccByMa(nccList: NccRow[], ma: string): NccRow | undefined {
  return nccList.find((n) => n.ma_ncc === ma)
}

/** gộp N đơn của 1 NCC thành 1 nội dung tin (port consolidate). */
export function consolidate(orders: PendingOrderRow[]): string {
  return orders.length === 1 ? orders[0].message : orders.map((o) => o.message).join('\n— — — — —\n')
}

/** gộp pending theo NCC (port groupPending) — storeFilter rỗng = không lọc. */
export function groupPending(pending: PendingOrderRow[], nccList: NccRow[], storeFilter: string): OrderGroup[] {
  const m = new Map<string, OrderGroup>()
  for (const p of pending) {
    if (isStale(p)) continue
    if (storeFilter && inferStore(p) !== storeFilter) continue
    const n = nccByMa(nccList, p.ma_ncc)
    const cat = inferCat(p, n)
    const key = p.ma_ncc && n ? `ma:${p.ma_ncc}` : `nm:${norm(p.ten_ncc)}`
    let g = m.get(key)
    if (!g) {
      g = {
        key,
        ma_ncc: n ? p.ma_ncc : '',
        ten_ncc: p.ten_ncc || n?.ten_ncc || p.ma_ncc || '(không tên)',
        ncc: n,
        cat,
        orders: [],
        mapped: false,
        active: false,
        sendable: false,
        reason: '',
        stores: [],
      }
      m.set(key, g)
    }
    g.orders.push(p)
  }
  return Array.from(m.values())
    .map((g) => {
      const mapped = !!(g.ncc && g.ncc.zalo_group_id)
      const active = nccActive(g.ncc)
      let reason = ''
      if (!g.ncc) reason = 'NCC chưa có trong danh bạ — sang NCC & Nhóm để tạo'
      else if (!active) reason = `NCC đang "${nccStatusLabel(g.ncc.status)}" — chỉ gửi khi Đang dùng`
      else if (!mapped) reason = 'NCC chưa gán nhóm Zalo'
      const stores = Array.from(new Set(g.orders.map(inferStore).filter(Boolean)))
      return { ...g, mapped, active, sendable: mapped && active, reason, stores }
    })
    .sort((a, b) => {
      if (a.sendable !== b.sendable) return a.sendable ? -1 : 1
      return norm(a.ten_ncc).localeCompare(norm(b.ten_ncc))
    })
}

/** đơn quá ngày giao → khu riêng (port stalePending). */
export function stalePending(pending: PendingOrderRow[], nccList: NccRow[]): OrderGroup[] {
  const m = new Map<string, OrderGroup>()
  for (const p of pending) {
    if (!isStale(p)) continue
    const n = nccByMa(nccList, p.ma_ncc)
    const cat = inferCat(p, n)
    const key = p.ma_ncc && n ? `ma:${p.ma_ncc}` : `nm:${norm(p.ten_ncc)}`
    let g = m.get(key)
    if (!g) {
      g = {
        key,
        ma_ncc: n ? p.ma_ncc : '',
        ten_ncc: p.ten_ncc || n?.ten_ncc || p.ma_ncc,
        ncc: n,
        cat,
        orders: [],
        mapped: false,
        active: false,
        sendable: false,
        reason: '',
        stores: [],
      }
      m.set(key, g)
    }
    g.orders.push(p)
  }
  return Array.from(m.values())
}

/** đếm số đơn (chưa quá ngày) theo nhà hàng — cho chip lọc (port storeCounts). */
export function storeCounts(pending: PendingOrderRow[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const p of pending) {
    if (isStale(p)) continue
    const s = inferStore(p)
    c[s] = (c[s] || 0) + 1
  }
  return c
}

/** Lọc về "đơn đặt hàng" (loại tin chat & broadcast thuộc màn khác — port isOrderRow). */
export function isOrderRow(r: { loai?: string; source?: string }): boolean {
  return !!r && (r.loai === 'don_dat_hang' || r.loai === 'nhac_giao' || r.source === 'base')
}

function nccLabel(nccList: NccRow[], ma: string): string {
  const n = nccByMa(nccList, ma)
  return n ? n.ten_ncc || n.ma_ncc : ma || '(không rõ NCC)'
}

/** ĐÃ GỬI: hàng đợi (đang chờ gửi) + log đã gửi (loại đơn đặt hàng) — port sentItems. */
export function sentItems(queue: SendQueueRow[], log: SendLogRow[], nccList: NccRow[]): SentItem[] {
  const q: SentItem[] = queue.filter(isOrderRow).map((x) => ({
    id: `q${x.id}`,
    ma_ncc: x.ma_ncc,
    ten: nccLabel(nccList, x.ma_ncc),
    msg: x.message,
    when: x.created_at,
    status: 'queued',
    sched: x.scheduled_at,
  }))
  const lg: SentItem[] = log
    .filter((l) => l.status === 'sent' && isOrderRow(l))
    .map((x) => ({
      id: `l${x.id}`,
      ma_ncc: x.ma_ncc,
      ten: nccLabel(nccList, x.ma_ncc),
      msg: x.message,
      when: x.sent_at,
      status: 'sent',
    }))
  return q.concat(lg)
}

/** Lỗi: log status khác 'sent' (loại đơn đặt hàng) — port failedItems. */
export function failedItems(log: SendLogRow[], nccList: NccRow[]): FailedItem[] {
  return log
    .filter((l) => l.status && l.status !== 'sent' && isOrderRow(l))
    .map((x) => ({
      id: `l${x.id}`,
      ma_ncc: x.ma_ncc,
      ten: nccLabel(nccList, x.ma_ncc),
      msg: x.message,
      when: x.sent_at,
      status: x.status,
      error: x.error,
    }))
}

/** Rút gọn nội dung tin cho hiển thị 1 dòng (port ".preview" trong sentBody/failBody). */
export function previewText(msg: string | undefined, max = 120): string {
  return (msg || '').replace(/\n/g, ' · ').slice(0, max)
}

/** Parse timestamp THÔ về Date. SQLite datetime('now') trả "YYYY-MM-DD HH:MM:SS" (UTC,
 * KHÔNG hậu tố) — coi chuỗi không có 'T'/'Z' là UTC trước khi new Date() (gotcha #6,
 * CLAUDE.md ZALO-INTEGRATION: so sánh/hiển thị timestamp SQLite thô mà không quy về UTC
 * trước gây lệch giờ hiển thị — orders.js gốc CHƯA áp luật này, vá ở đây theo luật đã chốt). */
export function toDate(raw: string | number | null | undefined): Date | null {
  if (raw === null || raw === undefined || raw === '') return null
  const s = String(raw)
  if (/^\d+$/.test(s)) {
    const d = new Date(Number(s))
    return isNaN(d.getTime()) ? null : d
  }
  const iso = s.includes('T') || s.endsWith('Z') ? s : `${s.replace(' ', 'T')}Z`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/** định dạng giờ:phút ngày/tháng vi-VN ngắn (port timeShort). */
export function timeShort(raw: string | number | null | undefined): string {
  const d = toDate(raw)
  if (!d) return ''
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}
