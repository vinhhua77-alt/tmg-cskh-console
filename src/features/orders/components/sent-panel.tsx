// NCC Hub v3 — Đặt hàng / tab "Đã gửi": hàng đợi (đang chờ gửi) + log đã gửi. Port sentBody(),
// orders.js.
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import type { SentItem } from '../types'
import { previewText, timeShort, toDate } from '../utils'
import { LogTable } from './log-table'

const columns: ColumnDef<SentItem>[] = [
  {
    accessorKey: 'ten',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Nhà cung cấp' />,
    cell: ({ row }) => <span className='font-medium'>{row.original.ten}</span>,
  },
  {
    accessorKey: 'msg',
    header: 'Nội dung',
    enableSorting: false,
    meta: { className: 'w-full' },
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground' title={row.original.msg}>
        {previewText(row.original.msg)}
      </span>
    ),
  },
  {
    id: 'trang_thai',
    header: 'Trạng thái',
    enableSorting: false,
    cell: ({ row }) => {
      const it = row.original
      return it.status === 'queued' ? (
        <Badge variant='outline'>{it.sched ? 'Đã hẹn giờ' : 'Đang chờ gửi'}</Badge>
      ) : (
        <Badge>Đã gửi</Badge>
      )
    },
  },
  {
    id: 'when',
    accessorFn: (it) => toDate(it.status === 'queued' && it.sched ? it.sched : it.when)?.getTime() ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title='Thời gian' />,
    cell: ({ row }) => {
      const it = row.original
      return <span>{timeShort(it.status === 'queued' && it.sched ? it.sched : it.when)}</span>
    },
  },
]

type SentPanelProps = { items: SentItem[] }

export function SentPanel({ items }: SentPanelProps) {
  return (
    <LogTable
      data={items}
      columns={columns}
      searchKey='ten'
      searchPlaceholder='Tìm theo tên NCC…'
      emptyMessage='Chưa có đơn nào được gửi hôm nay.'
    />
  )
}
