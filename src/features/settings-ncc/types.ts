// NCC Hub v3 — kiểu dữ liệu cho các bảng chưa được type đầy đủ trong useNccState()
// (NccState khai unknown[] cho templates/log/audit/users vì shape phụ thuộc route trả về;
// port từ admin/db.js + migrate_v2.cjs — xem schema thật ở đó khi cần đối chiếu).

export interface NccTemplate {
  id: number
  loai: 'don_dat_hang' | 'nhac_giao' | 'thong_bao' | string
  kenh: string
  tieu_de: string
  noi_dung: string
  active: number
  dept_id?: string
  shared?: number
}

export interface NccLogEntry {
  id: number
  loai: string
  kenh: string
  ma_ncc: string
  target: string
  message?: string
  status: string
  message_id?: string | null
  error?: string | null
  source?: string | null
  sent_by?: string | null
  dept_id?: string
  sent_at: string
}

export interface NccAuditEntry {
  id: number
  ts: string
  email: string
  action: string
  target: string
  detail: string
}

export interface NccAppUser {
  email: string
  display_name: string
  app_role: 'super_admin' | 'dept_manager' | 'dept_staff' | string
  dept_id: string
  active: number
}
