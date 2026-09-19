// NCC Hub v3 — Đặt hàng: mutation gọi thật admin/routes/pending.js. Mỗi hook chỉ lo gọi
// API + invalidate ['ncc-state'] (queryKey của useNccState) — toast/xử lý kết quả (sent/
// skipped/…) nằm ở call site vì thông báo khác nhau theo hành động (đơn lẻ vs hàng loạt).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { nccApi } from '@/lib/ncc-api'

function useInvalidateNccState() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['ncc-state'] })
}

export interface ApproveBatchGroup {
  ma_ncc: string
  ids: number[]
  message: string
}
export interface ApproveBatchResult {
  ok: boolean
  sent: number
  skipped: string[]
}

/** POST /api/pending/approve-batch — mỗi nhóm = 1 NCC nhiều đơn → 1 tin Zalo. */
export function useApproveBatch() {
  const invalidate = useInvalidateNccState()
  return useMutation({
    mutationFn: async (groups: ApproveBatchGroup[]) =>
      (await nccApi.post<ApproveBatchResult>('/pending/approve-batch', { groups })).data,
    onSuccess: () => invalidate(),
  })
}

/** POST /api/pending/:id/skip cho từng đơn (port skipNcc/skipStaleNcc/skipAllStale). */
export function useSkipOrders() {
  const invalidate = useInvalidateNccState()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => nccApi.post(`/pending/${id}/skip`)))
    },
    onSuccess: () => invalidate(),
  })
}

export interface ScheduleSendResult {
  ok: boolean
  queued: number
  skipped: string[]
}

/** POST /api/send (scheduled_at epoch ms) rồi skip các đơn gốc — port scheduleNcc. */
export function useScheduleSend() {
  const invalidate = useInvalidateNccState()
  return useMutation({
    mutationFn: async (vars: { ma_ncc: string; text: string; scheduledAtMs: number; orderIds: number[] }) => {
      const r = (
        await nccApi.post<ScheduleSendResult>('/send', {
          ma_ncc: vars.ma_ncc,
          loai: 'don_dat_hang',
          kenh: 'zalo',
          text: vars.text,
          source: 'base',
          scheduled_at: String(vars.scheduledAtMs),
        })
      ).data
      if (r.queued) {
        await Promise.all(vars.orderIds.map((id) => nccApi.post(`/pending/${id}/skip`)))
      }
      return r
    },
    onSuccess: () => invalidate(),
  })
}

export interface RelinkResult {
  ok: boolean
  linked: number
  remaining: number
}

/** POST /api/pending/relink — khớp lại đơn chưa map với danh bạ NCC hiện tại. */
export function useRelink() {
  const invalidate = useInvalidateNccState()
  return useMutation({
    mutationFn: async () => (await nccApi.post<RelinkResult>('/pending/relink', {})).data,
    onSuccess: () => invalidate(),
  })
}
