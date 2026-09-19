import {
  LayoutDashboard,
  Package,
  Settings,
  UserCog,
  Users,
  MessagesSquare,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

// NCC Hub v3 — nav thật, thay demo shadcn-admin (Clerk/Tasks/Apps/Auth-pages đã gỡ).
// user/teams tĩnh ở đây chỉ là fallback hiển thị trước khi /api/me trả về —
// AppSidebar đọc user thật từ useAuthStore (xem lib/ncc-auth.ts).
export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: '',
    avatar: '',
  },
  teams: [
    {
      name: 'NCC Hub',
      logo: Command,
      plan: 'Thái Mậu Group',
    },
  ],
  navGroups: [
    {
      title: 'NCC Hub',
      items: [
        {
          title: 'Trang chủ',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Hộp tin',
          url: '/chats',
          icon: MessagesSquare,
        },
        {
          title: 'Đặt hàng',
          url: '/orders',
          icon: Package,
        },
        {
          title: 'NCC & Nhóm',
          url: '/ncc',
          icon: Users,
        },
        {
          title: 'Cài đặt',
          icon: Settings,
          items: [
            {
              title: 'Cấu hình chung',
              url: '/settings',
              icon: UserCog,
            },
          ],
        },
      ],
    },
  ],
}
