// NCC Hub v3 — Đặt hàng / tab "Lỗi": send_log status khác 'sent'. Port failBody(), orders.js.
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import type { FailedItem } from '../types'
import { previewText, timeShort, toDate } from '../utils'
import { LogTable } from './log-table'

const columns: ColumnDef<FailedItem>[] = [
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
      <div className='flex flex-col gap-1'>
        <span className='text-sm text-muted-foreground' title={row.original.msg}>
          {previewText(row.original.msg)}
        </span>
        {row.original.error ? (
          <span className='text-xs text-destructive'>{row.original.error}</span>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    enableSorting: false,
    cell: ({ row }) => <Badge variant='destructive'>{row.original.status}</Badge>,
  },
  {
    id: 'when',
    accessorFn: (it) => toDate(it.when)?.getTime() ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title='Thời gian' />,
    cell: ({ row }) => <span>{timeShort(row.original.when)}</span>,
  },
]

type FailedPanelProps = { items: FailedItem[] }

export function FailedPanel({ items }: FailedPanelProps) {
  return (
    <LogTable
      data={items}
      columns={columns}
      searchKey='ten'
      searchPlaceholder='Tìm theo tên NCC…'
      emptyMessage='Không có tin lỗi. Tốt!'
    />
  )
}
