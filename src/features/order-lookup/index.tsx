// CSKH Console — "Tra cứu đơn": tiện ích nhỏ để nhân viên CSKH tự tra 1 đơn thủ công khi đang
// xử lý hội thoại (không cần trang riêng phức tạp — 1 form input SĐT/mã đơn + nút + hiện kết
// quả là đủ cho MVP, đúng việc D trong brief). Gọi POST /api/orders/lookup (ZALO-CSKH
// routes/orders.js) — LOOKUP CÓ CẤU TRÚC (deterministic, dữ liệu thật từ Haravan qua mcp-haravan),
// KHÔNG phải AI sinh câu trả lời tự do.
import { useState } from 'react'
import axios from 'axios'
import { nccApi } from '@/lib/ncc-api'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Response shape đọc THẲNG từ routes/orders.js — route chỉ dùng đúng 4 field này khi ghép chuỗi
// tóm tắt (order_number/financial_status/fulfillment_status/total_price), không đoán thêm field
// khác (đúng yêu cầu "DÙNG đoạn field" trong brief).
interface OrderRow {
  id?: number | string
  order_number?: number | string
  financial_status?: string
  fulfillment_status?: string
  total_price?: string | number
  [key: string]: unknown
}

interface LookupResult {
  ok: boolean
  orders?: OrderRow[]
  message?: string
}

export function OrderLookupPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LookupResult | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      // apiCall() coi `ok:false` là lỗi và throw — nhưng route lookup dùng `ok:false` cho case
      // "hợp lệ nhưng không tìm thấy đơn" (kèm `message` gợi ý), KHÔNG phải lỗi hệ thống. Gọi
      // trực tiếp nccApi ở đây (không qua apiCall) để giữ được cả 2 nhánh ok=true/false.
      const { data } = await nccApi.post<LookupResult>('/orders/lookup', { query: trimmed })
      setResult(data)
    } catch (err) {
      // Ưu tiên message thật từ backend (VD "Cần đăng nhập OS", "Không tra được đơn (Haravan): ...")
      // — err.message của axios chỉ là "Request failed with status code 401", không nói được gì.
      if (axios.isAxiosError<{ error?: string }>(err)) {
        setError(err.response?.data?.error || err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Không tra được đơn — thử lại sau.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <h1 className='mb-4 text-2xl font-bold tracking-tight'>Tra cứu đơn</h1>
        <Card className='max-w-xl'>
          <CardHeader>
            <CardTitle>Tra cứu đơn hàng DNF</CardTitle>
            <CardDescription>
              Nhập số điện thoại hoặc mã đơn khách cung cấp để tra nhanh trong khi đang xử lý hội
              thoại — kết quả lấy thật từ Haravan, không phải AI suy đoán.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className='flex gap-2'>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='SĐT (VD: 0901234567) hoặc mã đơn'
                autoFocus
              />
              <Button type='submit' disabled={loading || !query.trim()}>
                {loading ? 'Đang tra…' : 'Tra cứu'}
              </Button>
            </form>

            {error && (
              <p className='mt-4 text-sm text-destructive'>{error}</p>
            )}

            {result && !error && (
              <div className='mt-4'>
                {result.ok && result.orders && result.orders.length > 0 ? (
                  <ul className='space-y-2'>
                    {result.orders.map((o, idx) => (
                      <li
                        key={o.id ?? o.order_number ?? idx}
                        className='rounded-md border p-3 text-sm'
                      >
                        <div className='font-medium'>
                          #{o.order_number ?? o.id ?? '—'}
                        </div>
                        <div className='text-muted-foreground'>
                          {o.financial_status || 'chưa rõ thanh toán'} /{' '}
                          {o.fulfillment_status || 'chưa giao'}
                          {o.total_price ? ` — ${o.total_price}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    {result.message || 'Không tìm thấy đơn với thông tin này.'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
