// NCC Hub v3 — POST /api/config (admin/routes/config.js), super_admin ONLY. Backend audit mọi
// thay đổi và trả 403 nếu thiếu quyền; dùng chung cho section An toàn + Hệ thống.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { nccApi } from '@/lib/ncc-api'
import { getErrMsg } from '../lib/helpers'

export function useSetConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Record<string, string>) => nccApi.post('/config', patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ncc-state'] }),
    onError: (error) =>
      toast.error(getErrMsg(error, 'Lưu cấu hình lỗi (cần super_admin)')),
  })
}
