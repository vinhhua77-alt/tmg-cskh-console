// NCC Hub v3 — mutations thật cho NCC & Nhóm, gọi admin/routes/ncc.js + admin/routes/groups.js.
// Mỗi hook chỉ invalidate['ncc-state'] trong onSuccess (không toast ở đây — message thành
// công khác nhau theo nơi gọi, ví dụ "Đã gán nhóm" vs "Đã lưu NCC" cùng dùng useSaveNccMutation).
// Ngoại lệ: pull-base/sync-groups chỉ có đúng 1 nơi gọi nên toast thành công gộp luôn ở hook.
// onError LUÔN toast — vì handleServerError toàn cục (lib/handle-server-error.ts) đọc field
// "title", còn backend ở đây trả field "error"; định nghĩa onError riêng ở mọi hook để không
// mất message thật (xem error.ts).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { nccApi } from '@/lib/ncc-api'
import { nccErrorMessage } from './error'

type ApiResponse = { ok: boolean; error?: string; [key: string]: unknown }

async function post<T extends ApiResponse>(url: string, body: unknown): Promise<T> {
  const { data } = await nccApi.post<T>(url, body)
  if (!data.ok) throw new Error(data.error || 'Lỗi không xác định')
  return data
}

export interface SaveNccBody {
  ma_ncc?: string
  ten_ncc: string
  zalo_group_id?: string
  email?: string
  sdt?: string
  kenh_default?: string
  nhom_hang?: string
  ghi_chu?: string
  tags?: string[]
  active?: number
  dept_id?: string
}

/** POST /api/ncc — upsert theo ma_ncc (để trống thì server tự sinh / dùng lại mã đã gán
 * cho cùng zalo_group_id, xem comment trong routes/ncc.js). */
export function useSaveNccMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SaveNccBody) => post<{ ok: true; ma_ncc: string }>('/ncc', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ncc-state'] }),
    onError: (err) => toast.error(nccErrorMessage(err, 'Lỗi lưu NCC')),
  })
}

/** POST /api/ncc/:ma/status — đổi vòng đời, cần quyền canApprove (manager) ở server. */
export function useNccStatusMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ma, status }: { ma: string; status: string }) =>
      post<{ ok: true; status: string }>(`/ncc/${encodeURIComponent(ma)}/status`, {
        status,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ncc-state'] }),
    onError: (err) => toast.error(nccErrorMessage(err, 'Lỗi đổi vòng đời')),
  })
}

/** POST /api/base/pull-ncc — job nền (spawn child process), request treo vài giây rồi mới
 * trả {total,created,skipped}; endpoint này LUÔN trả HTTP 200 kể cả khi lỗi (res.json không
 * kèm status code), nên phải tự check data.ok — wrapper post() đã lo phần đó. */
export function usePullNccFromBaseMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      post<{ ok: true; total: number; created: number; skipped: number }>(
        '/base/pull-ncc',
        {}
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
      toast.success(
        `Base có ${data.total} NCC · tạo mới ${data.created} · trùng bỏ ${data.skipped}`
      )
    },
    onError: (err) => toast.error(nccErrorMessage(err, 'Lỗi kéo NCC từ Base')),
  })
}

/** POST /api/groups/:id/classify — gửi ĐÚNG field vừa đổi (dept_id | purpose | status),
 * server tự merge field còn lại — không gửi cả 3 field một lần để tránh ghi đè giá trị
 * người khác vừa đổi song song. */
export function useClassifyGroupMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      groupId,
      patch,
    }: {
      groupId: string
      patch: Record<string, string>
    }) => post<{ ok: true }>(`/groups/${encodeURIComponent(groupId)}/classify`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ncc-state'] }),
    onError: (err) => toast.error(nccErrorMessage(err, 'Lỗi phân loại nhóm')),
  })
}

/** POST /api/groups/sync — CHỈ super_admin (server trả 403 cho người khác); client ẩn nút
 * theo useNccAuthStore().isSuper nhưng vẫn phải toast đúng lỗi thật nếu lọt qua. */
export function useSyncGroupsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      post<{ ok: true; count: number; note?: string }>('/groups/sync', {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
      toast.success(data.note || `Đã đồng bộ ${data.count} nhóm`)
    },
    onError: (err) => toast.error(nccErrorMessage(err, 'Lỗi đồng bộ nhóm')),
  })
}
