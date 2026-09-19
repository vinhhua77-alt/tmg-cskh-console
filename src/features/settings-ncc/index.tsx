// NCC Hub v3 — Cài đặt thật, giữ shell tab/sidebar của shadcn-admin (route.tsx + sub-pages),
// thay nội dung demo bằng 5 section thật: Mẫu tin · Nhật ký · An toàn · Người dùng · Hệ thống ·
// Sức khỏe nick. Port từ admin/public/js/views/settings.js (sections()).
import { Outlet } from '@tanstack/react-router'
import { FileText, HeartPulse, History, Server, ShieldCheck, Users } from 'lucide-react'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from '@/features/settings/components/sidebar-nav'

export function SettingsNcc() {
  const isSuper = useNccAuthStore((s) => s.user?.isSuper) ?? false

  const sidebarNavItems = [
    { title: 'Mẫu tin', href: '/settings', icon: <FileText size={18} /> },
    { title: 'Nhật ký', href: '/settings/log', icon: <History size={18} /> },
    { title: 'An toàn', href: '/settings/safety', icon: <ShieldCheck size={18} /> },
    ...(isSuper
      ? [{ title: 'Người dùng', href: '/settings/users', icon: <Users size={18} /> }]
      : []),
    ...(isSuper ? [{ title: 'Hệ thống', href: '/settings/system', icon: <Server size={18} /> }] : []),
    { title: 'Sức khỏe nick', href: '/settings/health', icon: <HeartPulse size={18} /> },
  ]

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>Cài đặt</h1>
          <p className='text-muted-foreground'>
            Mẫu tin · Nhật ký · An toàn · Người dùng · Hệ thống · Sức khỏe nick
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
