// NCC Hub v3 — chạy osGate 1 lần lúc boot, chặn render route bảo vệ cho tới khi có kết quả.
// Thay cho gate cũ trong admin/public/js/app.js (boot() → osGate() trước initRouter()).
import { useEffect } from 'react'
import { runOsGate, useNccAuthStore } from '@/lib/ncc-auth'

function GateScreen({
  icon,
  title,
  message,
}: {
  icon: string
  title: string
  message?: string
}) {
  return (
    <div className='flex min-h-svh items-center justify-center bg-background px-6'>
      <div className='max-w-sm text-center'>
        <div className='text-4xl'>{icon}</div>
        <h2 className='mt-3 text-lg font-semibold text-foreground'>{title}</h2>
        {message && (
          <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
            {message}
          </p>
        )}
        <a
          href={
            'https://os.vinhhua.com/login.html?next=' +
            encodeURIComponent(location.href)
          }
          className='mt-4 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground'
        >
          Đăng nhập lại
        </a>
      </div>
    </div>
  )
}

export function NccAuthGate({ children }: { children: React.ReactNode }) {
  const status = useNccAuthStore((s) => s.status)
  const message = useNccAuthStore((s) => s.message)

  useEffect(() => {
    runOsGate()
  }, [])

  if (status === 'loading') {
    return (
      <div className='flex min-h-svh items-center justify-center bg-background'>
        <div className='text-sm text-muted-foreground'>Đang xác thực…</div>
      </div>
    )
  }
  if (status === 'denied') {
    return (
      <GateScreen icon='🔒' title='Chưa được cấp quyền' message={message} />
    )
  }
  if (status === 'error') {
    return <GateScreen icon='⟳' title='Lỗi đăng nhập' message={message} />
  }
  return <>{children}</>
}
