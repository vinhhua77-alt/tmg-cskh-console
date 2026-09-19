// NCC Hub v3 — Đặt hàng (Orders). Kiểu dữ liệu THÔ khớp đúng schema admin/db.js +
// admin/migrate_v2.cjs (đã đọc trực tiếp, KHÔNG đoán field name). useNccState() trả các
// mảng này với type rộng (`unknown[]` / index signature) vì hook đó dùng chung cho mọi
// trang — ở đây ta ép lại về shape thật để làm việc có kiểu trong feature này.

/** admin/db.js: CREATE TABLE pending_order + migrate_v2 (dept_id/confirm_status/confirmed_at). */
export interface PendingOrderRow {
  id: number
  ticket_id: string
  ma_ncc: string
  ten_ncc: string
  title: string
  message: string
  status: string
  created_at: string
  dept_id: string
  confirm_status: string
  confirmed_at: string
}

/** admin/db.js: CREATE TABLE send_queue + migrate_v2 (dept_id) + scheduled_at (ALTER). */
export interface SendQueueRow {
  id: number
  loai: string
  kenh: string
  ma_ncc: string
  target: string
  message: string
  status: string
  attempts: number
  source: string
  dedup_key: string
  created_at: string
  scheduled_at: string
  dept_id: string
}

/** admin/db.js: CREATE TABLE send_log + migrate_v2 (dept_id). */
export interface SendLogRow {
  id: number
  loai: string
  kenh: string
  ma_ncc: string
  target: string
  message: string
  status: string
  message_id: string
  error: string
  source: string
  sent_by: string
  sent_at: string
  dept_id: string
}

/** admin/db.js: CREATE TABLE ncc + migrate_v2 (status/dept_id/approved_by, v.v.) + tags (routes/state.js). */
export interface NccRow {
  ma_ncc: string
  ten_ncc: string
  zalo_group_id: string
  email: string
  kenh_default: string
  active: number
  sdt: string
  ghi_chu: string
  updated_at: string
  nhom_hang: string
  status: string
  dept_id: string
  approved_by: string
  approved_at: string
  last_order_at: string
  n_orders: number
  source: string
  created_at: string
  tags: string[]
}

/** Nhóm hàng suy từ tiêu đề/nhom_hang (port inferCat, orders.js). */
export interface OrderCategory {
  key: string
  name: string
}

/** 1 NCC gộp N đơn chờ duyệt (port groupPending, orders.js). */
export interface OrderGroup {
  key: string
  ma_ncc: string
  ten_ncc: string
  ncc: NccRow | undefined
  cat: OrderCategory
  orders: PendingOrderRow[]
  mapped: boolean
  active: boolean
  sendable: boolean
  reason: string
  stores: string[]
}

/** Dòng hiển thị ở tab "Đã gửi" — gộp send_queue (đang chờ) + send_log (status='sent'). */
export interface SentItem {
  id: string
  ma_ncc: string
  ten: string
  msg: string
  when: string
  status: 'queued' | 'sent'
  sched?: string
}

/** Dòng hiển thị ở tab "Lỗi" — send_log status khác 'sent'. */
export interface FailedItem {
  id: string
  ma_ncc: string
  ten: string
  msg: string
  when: string
  status: string
  error?: string
}
