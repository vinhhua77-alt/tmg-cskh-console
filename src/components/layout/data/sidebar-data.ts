import { Command, MessagesSquare, Search } from 'lucide-react'
import { type SidebarData } from '../types'

// CSKH Console — nav thật cho nhân viên chăm sóc khách hàng xử lý hội thoại Zalo OA với khách
// hàng (khác nghiệp vụ NCC Hub — mua vào). user/teams tĩnh ở đây chỉ là fallback hiển thị trước
// khi /api/me trả về — AppSidebar đọc user thật từ useAuthStore (xem lib/ncc-auth.ts).
export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: '',
    avatar: '',
  },
  teams: [
    {
      name: 'CSKH Console',
      logo: Command,
      plan: 'Thái Mậu Group',
    },
  ],
  navGroups: [
    {
      title: 'CSKH Console',
      items: [
        {
          title: 'Hộp thư CSKH',
          url: '/cskh-inbox',
          icon: MessagesSquare,
        },
        {
          title: 'Tra cứu đơn',
          url: '/order-lookup',
          icon: Search,
        },
      ],
    },
  ],
}
