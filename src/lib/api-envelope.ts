/// <reference lib="es2022.error" />
// Chỉ file này cần type `Error(message, { cause })` (ES2022) — tsconfig.app.json chung của repo
// target ES2020/lib ES2020 (không đổi, nhiều route khác phụ thuộc); triple-slash reference nạp
// thêm đúng 1 lib.d.ts cho riêng file này (giữ đúng cách chats-ncc/index.tsx gốc đã làm).
// CSKH Console — helper dùng chung cho mọi route admin/routes/*.js (ZALO-CSKH backend): envelope
// trả `{ok:false, error}` kèm HTTP 200 cho một số case (axios KHÔNG tự throw cho case này, chỉ
// throw khi status ngoài 2xx) — bù đúng phần requestJson() kiểu cũ đã làm ở NCC Hub
// (src/features/chats-ncc/index.tsx trước khi bị gỡ khỏi repo này). Dùng chung cho
// cskh-inbox và order-lookup, tránh lặp lại logic ở 2 nơi.
import axios from 'axios'

export interface ApiEnvelope {
  ok?: boolean
  error?: string
  [key: string]: unknown
}

export async function apiCall<T extends ApiEnvelope>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    const { data } = await promise
    if (data?.ok === false) {
      throw new Error(data.error || 'API trả lỗi')
    }
    return data
  } catch (error) {
    // axios.isCancel() cần error gốc — không bọc lại thành Error thường (nơi gọi có request bị
    // huỷ, ví dụ đổi lựa chọn giữa lúc chờ, cần phân biệt "huỷ" với "lỗi thật").
    if (axios.isCancel(error)) throw error
    if (axios.isAxiosError<ApiEnvelope>(error)) {
      const detail = error.response?.data?.error
      throw new Error(
        detail || (error.response ? `HTTP ${error.response.status}` : error.message),
        { cause: error }
      )
    }
    throw error
  }
}
