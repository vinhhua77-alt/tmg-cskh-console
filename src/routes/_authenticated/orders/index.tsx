import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/orders/')({
  component: OrdersPage,
})

// TODO(NCC Hub v3 — Phase B): port pending.js API (/api/pending/*) vào đây,
// thay admin/public/js/views/orders.js cũ. Placeholder tạm để route sống.
function OrdersPage() {
  return (
    <div className='p-6'>
      <h1 className='text-2xl font-bold'>Đặt hàng</h1>
      <p className='text-muted-foreground mt-2'>Đang xây — Phase B.</p>
    </div>
  )
}
