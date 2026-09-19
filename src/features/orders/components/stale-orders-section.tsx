// NCC Hub v3 — Đặt hàng / tab "Chờ duyệt": khu riêng đơn quá ngày giao (port khối
// "Đơn quá ngày giao" trong pendBody(), orders.js). KHÔNG vào duyệt-tất-cả/gộp thường —
// backend vẫn gate dang_dung+nhóm khi bấm "Vẫn gửi" (POST /api/pending/approve-batch).
import { Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OrderGroup } from '../types'
import { nccActive } from '../utils'

type StaleOrdersSectionProps = {
  groups: OrderGroup[]
  onSendStale: (g: OrderGroup) => void
  onSkipStale: (g: OrderGroup) => void
  onSkipAllStale: () => void
}

export function StaleOrdersSection({
  groups,
  onSendStale,
  onSkipStale,
  onSkipAllStale,
}: StaleOrdersSectionProps) {
  if (!groups.length) return null
  const total = groups.reduce((s, g) => s + g.orders.length, 0)

  return (
    <div className='mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40'>
      <div className='mb-2 flex items-center gap-2'>
        <b className='text-sm font-semibold text-amber-800 dark:text-amber-300'>Đơn quá ngày giao</b>
        <Badge variant='outline'>{total} đơn</Badge>
        <Button variant='outline' size='sm' className='ms-auto' onClick={onSkipAllStale}>
          Đã xử lý tất cả
        </Button>
      </div>
      <p className='mb-3 text-sm text-muted-foreground'>
        Ngày giao đã qua — có thể đã xử lý tay. Kiểm tra trước khi gửi lại để khỏi làm phiền NCC.
      </p>
      <div className='space-y-2'>
        {groups.map((g) => {
          const can = nccActive(g.ncc) && !!g.ncc?.zalo_group_id
          return (
            <div
              key={g.key}
              className='flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3'
            >
              <div>
                <div className='font-medium'>{g.ten_ncc}</div>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <Badge variant='outline'>{g.orders.length} đơn quá ngày</Badge>
                  <span>{g.orders.map((o) => `#${o.ticket_id || o.id}`).join(', ')}</span>
                </div>
              </div>
              <div className='flex gap-2'>
                {can ? (
                  <Button size='sm' onClick={() => onSendStale(g)}>
                    <Send className='size-4' />
                    Vẫn gửi
                  </Button>
                ) : null}
                <Button variant='outline' size='sm' onClick={() => onSkipStale(g)}>
                  Đã xử lý / bỏ
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
