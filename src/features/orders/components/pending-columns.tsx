// NCC Hub v3 — Đặt hàng / tab "Chờ duyệt": cột cho bảng gộp-theo-NCC (port pendCard, orders.js).
// Checkbox chỉ chọn được NCC sendable=true (đủ điều kiện gửi); NCC bị chặn chỉ có nút "Bỏ".
import { type ColumnDef } from '@tanstack/react-table'
import { Lock, Send, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import type { NccState } from '@/hooks/use-ncc-state'
import type { OrderGroup } from '../types'
import { storeLabel, whyCannotSend } from '../utils'

type Me = NccState['me']

type BuildColumnsArgs = {
  me: Me | undefined
  groupName: (groupId: string) => string
  onPreview: (g: OrderGroup) => void
  onApprove: (g: OrderGroup) => void
  onSkip: (g: OrderGroup) => void
}

export function buildPendingColumns({
  me,
  groupName,
  onPreview,
  onApprove,
  onSkip,
}: BuildColumnsArgs): ColumnDef<OrderGroup>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Chọn tất cả'
          className='translate-y-0.5'
        />
      ),
      cell: ({ row }) =>
        row.original.sendable ? (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label='Chọn NCC này'
            className='translate-y-0.5'
          />
        ) : (
          <span title='Chưa gửi được' className='text-muted-foreground'>
            <Lock className='size-4' />
          </span>
        ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-10' },
    },
    {
      accessorKey: 'ten_ncc',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Nhà cung cấp' />,
      cell: ({ row }) => {
        const g = row.original
        const tickets = g.orders.map((o) => `#${o.ticket_id || o.id}`).join(', ')
        return (
          <div className='flex flex-col gap-1.5 py-1'>
            <span className='font-medium'>{g.ten_ncc}</span>
            <div className='flex flex-wrap items-center gap-1'>
              <Badge variant='outline'>{g.cat.name}</Badge>
              <Badge variant='secondary' title={tickets}>
                {g.orders.length} đơn{g.orders.length > 1 ? ' → gộp 1 tin' : ''}
              </Badge>
              {g.stores.map((s) => (
                <Badge key={s} variant='outline'>
                  {storeLabel(s)}
                </Badge>
              ))}
              {g.mapped && g.ncc?.zalo_group_id ? (
                <span className='text-xs text-muted-foreground'>
                  → {groupName(g.ncc.zalo_group_id)}
                </span>
              ) : null}
            </div>
            {!g.sendable && g.reason ? (
              <div className='flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400'>
                <TriangleAlert className='size-3 shrink-0' />
                <span>{g.reason}</span>
              </div>
            ) : null}
          </div>
        )
      },
      meta: { className: 'w-full' },
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const g = row.original
        if (!g.sendable) {
          return (
            <Button variant='outline' size='sm' onClick={() => onSkip(g)}>
              Bỏ {g.orders.length} đơn
            </Button>
          )
        }
        const why = whyCannotSend(me, g.ncc)
        return (
          <div className='flex items-center justify-end gap-2 whitespace-nowrap'>
            <Button variant='outline' size='sm' onClick={() => onPreview(g)}>
              Xem trước
            </Button>
            <Button size='sm' disabled={!!why} title={why || undefined} onClick={() => onApprove(g)}>
              <Send className='size-4' />
              Duyệt &amp; gửi
            </Button>
            <Button variant='ghost' size='sm' onClick={() => onSkip(g)}>
              Bỏ
            </Button>
          </div>
        )
      },
      meta: { className: 'text-end', tdClassName: 'text-end' },
    },
  ]
}
