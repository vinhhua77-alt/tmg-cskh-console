import { Link } from '@tanstack/react-router'
import { MessagesSquare, Search } from 'lucide-react'
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
import { Search as SearchCommand } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

// CSKH Console — Dashboard. Bản NCC Hub cũ (KPI đơn chờ duyệt/NCC đang dùng/nhóm cần rep) gọi
// /api/state — endpoint đó KHÔNG tồn tại ở backend ZALO-CSKH (repo khác, xem
// ~/TMG_APPS/ZALO-CSKH/routes/queue.js + orders.js) và các khái niệm đó (NCC/nhóm mua vào)
// không áp dụng cho nghiệp vụ CSKH (bán ra) — giữ nguyên khung Header/Main (route/feature không
// bị xoá theo brief), thay nội dung bằng 2 lối tắt tới 2 trang thật của CSKH Console. KPI thật
// cho trang này (số hội thoại đang chờ, đã đóng trong ngày…) để làm sau khi có nhu cầu cụ thể.
export function Dashboard() {
  return (
    <>
      <Header>
        <SearchCommand />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Trang chủ</h1>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <CardTitle className='text-sm font-medium'>Hộp thư CSKH</CardTitle>
              <MessagesSquare className='text-muted-foreground size-4' />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Hội thoại Zalo OA đang chờ hoặc đang được xử lý.
              </CardDescription>
              <Link
                to='/cskh-inbox'
                className='mt-2 inline-block text-sm font-medium hover:underline'
              >
                Mở hộp thư →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <CardTitle className='text-sm font-medium'>Tra cứu đơn</CardTitle>
              <Search className='text-muted-foreground size-4' />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Tra nhanh 1 đơn hàng DNF bằng SĐT hoặc mã đơn.
              </CardDescription>
              <Link
                to='/order-lookup'
                className='mt-2 inline-block text-sm font-medium hover:underline'
              >
                Tra cứu →
              </Link>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
