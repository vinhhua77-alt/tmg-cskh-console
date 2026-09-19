import { Link } from '@tanstack/react-router'
import { AlertTriangle, Inbox, MessageSquare, Truck } from 'lucide-react'
import { useGatewayHealth, useNccState } from '@/hooks/use-ncc-state'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

// NCC Hub v3 — Dashboard thật, port từ admin/public/js/views/dashboard.js (KPI + safety bar +
// "cần rep gấp"). Đây là trang chứng minh pipeline auth+api+theme chạy thật (Phase A) — các
// trang còn lại (Đặt hàng/NCC & Nhóm/Cài đặt/Hộp tin) build ở Phase B.

const MODE_LABEL: Record<string, string> = {
  paused: 'Đã tạm dừng',
  live: 'Đang gửi THẬT',
  test: 'Chế độ THỬ',
}

function needsReply(m: { is_self: number; handled_by: string | null; handled_at: string | null; kind: string | null }) {
  return Number(m.is_self) === 0 && !m.handled_by && !m.handled_at && m.kind !== 'confirm'
}

export function Dashboard() {
  const { data, isLoading } = useNccState()
  const { data: health } = useGatewayHealth()

  const pendingCount = data?.pending.length ?? 0
  const usingCount = data?.ncc.filter((n) => n.status === 'dang_dung').length ?? 0
  const noreplyCount = data?.confirm?.noreply ?? 0
  const repGroupIds = new Set((data?.messages ?? []).filter(needsReply).map((m) => m.group_id))
  const groupName = (gid: string) => data?.groups.find((g) => g.group_id === gid)?.name || gid

  const mode = data?.cfg?.mode || (data?.cfg?.zalo_live === '1' ? 'live' : 'test')
  const zaloMax = Number(data?.cfg?.zalo_max_per_day) || 200

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Trang chủ</h1>
          <div className='flex items-center gap-3 text-sm'>
            <span className='rounded-full border px-3 py-1 font-medium'>
              {isLoading ? 'Đang tải…' : MODE_LABEL[mode] || mode}
              {data ? ` · ${data.stats.today}/${zaloMax}` : ''}
            </span>
            <span className='flex items-center gap-1.5'>
              <span
                className={`h-2 w-2 rounded-full ${health?.gateway?.ok ? 'bg-chart-3' : 'bg-destructive'}`}
              />
              {health?.gateway?.ok ? 'Gateway sống' : 'Mất kết nối'}
            </span>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <CardTitle className='text-sm font-medium'>Đơn chờ duyệt</CardTitle>
              <Inbox className='text-muted-foreground size-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{pendingCount}</div>
              <CardDescription>
                <Link to='/orders' className='hover:underline'>
                  Xem đặt hàng →
                </Link>
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <CardTitle className='text-sm font-medium'>NCC đang dùng</CardTitle>
              <Truck className='text-muted-foreground size-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{usingCount}</div>
              <CardDescription>
                <Link to='/ncc' className='hover:underline'>
                  Xem NCC & Nhóm →
                </Link>
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <CardTitle className='text-sm font-medium'>NCC chưa phản hồi</CardTitle>
              <AlertTriangle className='text-muted-foreground size-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{noreplyCount}</div>
              <CardDescription>Quá 16h chưa xác nhận</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <CardTitle className='text-sm font-medium'>Nhóm cần rep</CardTitle>
              <MessageSquare className='text-muted-foreground size-4' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{repGroupIds.size}</div>
              <CardDescription>
                <Link to='/chats' className='hover:underline'>
                  Xem hộp tin →
                </Link>
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {repGroupIds.size > 0 && (
          <Card className='mt-4'>
            <CardHeader>
              <CardTitle className='text-base'>Cần rep gấp</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-2'>
              {[...repGroupIds].slice(0, 8).map((gid) => (
                <Link
                  key={gid}
                  to='/chats'
                  className='flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent'
                >
                  <span>{groupName(gid)}</span>
                  <span className='text-muted-foreground'>Xem hộp tin →</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
