// NCC Hub v3 — hằng số + helper thuần port từ admin/public/js/views/ncc.js
// (NCC_CATS/NCC_STATES/GROUP_STATES/PURPOSES, stateOf/nccName/norm), khớp đúng enum
// backend thật: ZALO-INTEGRATION/admin/routes/ncc.js (NCC_STATES) và
// ZALO-INTEGRATION/admin/routes/groups.js (PURPOSES/GSTATES). Đổi enum ở 1 trong 2
// nơi thì phải đổi cả nơi kia.
import type { NccGroup, NccVendor } from '@/hooks/use-ncc-state'

/** sentinel cho <Select> — Radix Select cấm value="" (option "chưa gán/chưa rõ"
 * dùng chuỗi rỗng ở API, nhưng UI phải map qua sentinel này rồi đổi lại '' khi gửi). */
export const UNSET = '__unset__'

/** giá trị đặc biệt trong dialog Gán hàng loạt: tạo NCC mới thay vì gán vào NCC có sẵn */
export const CREATE_NEW = '__new__'

// use-ncc-state.ts khai báo NccVendor/NccGroup với index signature [key:string]:unknown
// cho các field ít dùng — mở rộng tại đây để có kiểu chặt hơn trong feature này, KHÔNG
// sửa hook dùng chung (agent khác đang song song dùng cùng hook).
export interface Vendor extends NccVendor {
  email?: string
  sdt?: string
  kenh_default?: 'zalo' | 'email' | 'both'
  ghi_chu?: string
  zalo_group_id?: string
  nhom_hang?: string
}

export interface Group extends NccGroup {
  purpose?: string
  status?: 'watch' | 'active' | 'archived'
  labeled_by?: string
  labeled_at?: string
}

export const NCC_CATS = [
  'Trứng',
  'Thịt',
  'Hải sản',
  'Đậu / Chay',
  'Rau củ quả',
  'Khô / Gia vị',
  'Khác',
]

export const NCC_STATES = [
  ['cho_duyet', 'Chờ duyệt'],
  ['dang_dung', 'Đang dùng'],
  ['tam_dung', 'Tạm dừng'],
  ['ngung', 'Ngưng'],
] as const

export type NccLifecycle = (typeof NCC_STATES)[number][0]

export const NCC_STATE_LABEL: Record<string, string> = Object.fromEntries(NCC_STATES)

export const GROUP_STATES = [
  ['watch', 'Chờ phân loại'],
  ['active', 'Đang dùng'],
  ['archived', 'Lưu trữ'],
] as const

export type GroupLifecycle = (typeof GROUP_STATES)[number][0]

export const GROUP_STATE_LABEL: Record<string, string> = Object.fromEntries(GROUP_STATES)

export const PURPOSES = [
  ['', '— chưa rõ —'],
  ['ncc', 'Nhà cung cấp'],
  ['internal', 'Nội bộ'],
  ['partner', 'Đối tác'],
  ['personal', 'Cá nhân'],
  ['noise', 'Tạp / bỏ'],
] as const

export const PURPOSE_LABEL: Record<string, string> = Object.fromEntries(PURPOSES)

/** bỏ dấu + hạ chữ thường — port nguyên văn store.js norm() để search accent-insensitive. */
export function norm(s: unknown): string {
  return (s == null ? '' : String(s))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
}

export function nccName(n: Vendor): string {
  return n.ten_ncc || n.ma_ncc || '(không tên)'
}

/** vòng đời thực: ưu tiên cột status; fallback active (DB derived) — port stateOf(). */
export function stateOf(n: Vendor): NccLifecycle {
  return (n.status as NccLifecycle) || (n.active ? 'dang_dung' : 'cho_duyet')
}

export function isTmpCode(ma: string | undefined): boolean {
  return !!ma && ma.startsWith('TMP')
}

/** payload đủ trường cho POST /api/ncc (upsert) — server đọc lại field còn lại từ
 * body nên mọi lần "sửa 1 field" (quick tag/map) đều phải gửi kèm nguyên vẹn field khác. */
export function toNccBody(n: Vendor, patch: Partial<Vendor> = {}) {
  const merged = { ...n, ...patch }
  return {
    ma_ncc: merged.ma_ncc,
    ten_ncc: merged.ten_ncc || '',
    zalo_group_id: merged.zalo_group_id || '',
    email: merged.email || '',
    sdt: merged.sdt || '',
    kenh_default: merged.kenh_default || 'zalo',
    nhom_hang: merged.nhom_hang || '',
    ghi_chu: merged.ghi_chu || '',
    tags: merged.tags || [],
    active: merged.active ? 1 : 0,
  }
}
