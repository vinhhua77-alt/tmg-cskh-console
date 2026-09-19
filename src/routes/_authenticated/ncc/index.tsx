import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/ncc/')({
  component: NccPage,
})

// TODO(NCC Hub v3 — Phase B): port ncc.js + groups.js API vào đây,
// thay admin/public/js/views/ncc.js cũ. Placeholder tạm để route sống.
function NccPage() {
  return (
    <div className='p-6'>
      <h1 className='text-2xl font-bold'>NCC & Nhóm</h1>
      <p className='text-muted-foreground mt-2'>Đang xây — Phase B.</p>
    </div>
  )
}
