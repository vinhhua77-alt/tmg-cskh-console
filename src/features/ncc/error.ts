// NCC Hub v3 — đọc message lỗi THẬT từ backend.
// Mọi route ncc.js/groups.js trả {ok:false, error:'...'} — kể cả /api/base/pull-ncc trả
// HTTP 200 khi lỗi (không set status code), nên axios KHÔNG throw cho case đó; mutations.ts
// tự throw Error(data.error) trong wrapper post(). Còn 400/403/404 thì axios throw AxiosError
// thật, message nằm ở error.response.data.error (field "error", KHÔNG phải "title" như
// handle-server-error.ts mặc định của template gốc kỳ vọng) — nên mọi mutation ở đây tự
// đọc message qua helper này thay vì dựa vào default onError toàn cục.
import { AxiosError } from 'axios'

export function nccErrorMessage(err: unknown, fallback = 'Có lỗi xảy ra'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
