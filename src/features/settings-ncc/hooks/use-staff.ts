// NCC Hub v3 — GET /api/staff · GET /api/staff/status (admin/routes/staff.js), super_admin ONLY.
// Không có trong useNccState()/api/state — cần query riêng cho picker nhân viên Base ở màn Người dùng.
import { useQuery } from '@tanstack/react-query'
import { nccApi } from '@/lib/ncc-api'

export interface StaffRow {
  code: string
  name: string
  email: string
  title: string
  office_id: string
  office_name: string
}

export interface StaffOffice {
  id: string
  name: string
  n: number
}

export interface StaffSearchResult {
  ok: boolean
  total: number
  truncated: boolean
  staff: StaffRow[]
  offices: StaffOffice[]
  cached_at: string
  error?: string
}

/** Nạp danh mục phòng ban + roster ban đầu (không lọc) — dùng để đổ vào bộ lọc phòng ban. */
export function useStaffOffices(enabled: boolean) {
  return useQuery({
    queryKey: ['ncc-staff-offices'],
    queryFn: async () => (await nccApi.get<StaffSearchResult>('/staff')).data,
    enabled,
    staleTime: 30 * 60 * 1000, // roster đổi rất chậm — khớp TTL cache 30' phía server
  })
}

/** Tìm kiếm theo tên/mã/email + lọc phòng ban — chỉ gọi khi có ít nhất 2 ký tự hoặc đã chọn phòng. */
export function useStaffSearch(q: string, office: string) {
  const query = q.trim()
  const enabled = query.length >= 2 || !!office
  return useQuery({
    queryKey: ['ncc-staff', query, office],
    queryFn: async () =>
      (await nccApi.get<StaffSearchResult>('/staff', { params: { q: query, office } })).data,
    enabled,
    staleTime: 30 * 1000,
  })
}

export interface StaffStatusEntry {
  found: boolean
  code?: string
  name?: string
  title?: string
  office_name?: string
  terminated?: boolean
  terminated_date?: string
}

export interface StaffStatusResult {
  ok: boolean
  status: Record<string, StaffStatusEntry>
}

/** Soi trạng thái nhân sự (đang làm / đã nghỉ / không có trong Base) của các email đang có quyền. */
export function useStaffStatus(emails: string[]) {
  const key = [...emails].sort().join(',')
  return useQuery({
    queryKey: ['ncc-staff-status', key],
    queryFn: async () =>
      (await nccApi.get<StaffStatusResult>('/staff/status', { params: { emails: key } })).data,
    enabled: emails.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
