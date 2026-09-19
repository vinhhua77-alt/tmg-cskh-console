// NCC Hub v3 — sub-tab "NCC" (danh bạ nhà cung cấp). Port hành vi thật từ
// admin/public/js/views/ncc.js (nccVisible/nccCard/nccTable/quickMapNcc/quickTagNcc/
// changeNccState/bulkState/pullNccFromBase) sang shadcn data-table + TanStack Table.
//
// Cố ý khác bản cũ (đáng nói trong report):
// - Dùng phân trang (DataTablePagination) nên KHÔNG cần trick "lazy render option nhóm
//   Zalo khi focus" của bản cũ (comment PERF trong ncc.js) — Radix <Select> chỉ mount
//   SelectContent lúc mở, và mỗi trang chỉ có ~10 dòng, nên vấn đề "7000 node" không còn.
// - "Duyệt NCC mới" không dựng lại 1 sub-view riêng (approveMode) — dùng luôn facet filter
//   Vòng đời=Chờ duyệt trên bảng chính; người dùng duyệt/từ chối bằng đúng ô Vòng đời + bulk
//   actions có sẵn. Xem thêm phần "deferred" trong report cuối task.
import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Download, Link2, Pencil, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useNccState } from '@/hooks/use-ncc-state'
import { useNccAuthStore } from '@/lib/ncc-auth'
import {
  DataTableBulkActions,
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  NCC_CATS,
  NCC_STATES,
  NCC_STATE_LABEL,
  UNSET,
  type Group,
  type NccLifecycle,
  type Vendor,
  isTmpCode,
  nccName,
  norm,
  stateOf,
  toNccBody,
} from './data'
import { useNccStatusMutation, usePullNccFromBaseMutation, useSaveNccMutation } from './mutations'

function NhomHangCell({ vendor }: { vendor: Vendor }) {
  const saveMutation = useSaveNccMutation()
  const current = vendor.nhom_hang || ''
  const extra = current && !NCC_CATS.includes(current) ? [current] : []
  return (
    <Select
      value={current || UNSET}
      onValueChange={(v) => {
        const val = v === UNSET ? '' : v
        saveMutation.mutate(toNccBody(vendor, { nhom_hang: val }), {
          onSuccess: () => toast.success(val ? `Nhóm hàng: ${val}` : 'Đã bỏ nhóm hàng'),
        })
      }}
    >
      <SelectTrigger size='sm' className='w-40'>
        <SelectValue placeholder='— nhóm hàng —' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>— nhóm hàng —</SelectItem>
        {[...NCC_CATS, ...extra].map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ZaloGroupCell({
  vendor,
  groups,
  testGroupId,
}: {
  vendor: Vendor
  groups: Group[]
  testGroupId?: string
}) {
  const saveMutation = useSaveNccMutation()
  const options = groups.filter((g) => g.group_id !== testGroupId)
  const current = vendor.zalo_group_id || ''
  return (
    <Select
      value={current || UNSET}
      onValueChange={(v) => {
        const val = v === UNSET ? '' : v
        saveMutation.mutate(toNccBody(vendor, { zalo_group_id: val }), {
          onSuccess: () => toast.success(val ? 'Đã gán nhóm' : 'Đã bỏ gán'),
        })
      }}
    >
      <SelectTrigger size='sm' className='w-48'>
        <SelectValue placeholder='— chưa gán —' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>— chưa gán —</SelectItem>
        {options.map((g) => (
          <SelectItem key={g.group_id} value={g.group_id}>
            {g.name || g.group_id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function LifecycleCell({ vendor }: { vendor: Vendor }) {
  const statusMutation = useNccStatusMutation()
  const current = stateOf(vendor)
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v === current) return
        if (
          v === 'dang_dung' &&
          !window.confirm(
            `Chuyển "${nccName(vendor)}" sang ĐANG DÙNG?\nNCC này sẽ nhận tin khi hệ thống ở chế độ GỬI THẬT.`
          )
        ) {
          return
        }
        statusMutation.mutate(
          { ma: vendor.ma_ncc, status: v },
          {
            onSuccess: () =>
              toast.success(`${nccName(vendor)} → ${NCC_STATE_LABEL[v] || v}`),
          }
        )
      }}
    >
      <SelectTrigger size='sm' className='w-36'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NCC_STATES.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function NccTable({
  onAdd,
  onEdit,
  onBulkMap,
}: {
  onAdd: () => void
  onEdit: (vendor: Vendor) => void
  onBulkMap: () => void
}) {
  const { data, isLoading } = useNccState()
  const isSuper = useNccAuthStore((s) => s.user?.isSuper ?? false)
  const pullMutation = usePullNccFromBaseMutation()
  const statusMutation = useNccStatusMutation()

  const vendors = useMemo(() => (data?.ncc ?? []) as Vendor[], [data])
  const groups = useMemo(() => (data?.groups ?? []) as Group[], [data])
  const testGroupId = data?.cfg?.test_group_id

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    mapped: false,
  })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [bulkChanging, setBulkChanging] = useState(false)

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label='Chọn tất cả'
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label='Chọn NCC'
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'name',
        accessorFn: (n) => nccName(n),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Nhà cung cấp' />
        ),
        cell: ({ row }) => {
          const n = row.original
          const code = !isTmpCode(n.ma_ncc) ? n.ma_ncc : ''
          const meta = [code, n.dept_id].filter(Boolean).join(' · ')
          return (
            <div>
              <div className='font-medium'>{nccName(n)}</div>
              {meta && (
                <div className='text-xs text-muted-foreground'>{meta}</div>
              )}
            </div>
          )
        },
      },
      {
        id: 'nhom_hang',
        accessorFn: (n) => n.nhom_hang || '',
        header: 'Nhóm hàng',
        filterFn: (row, id, value: string[]) =>
          !value?.length || value.includes(row.getValue(id) as string),
        cell: ({ row }) => <NhomHangCell vendor={row.original} />,
      },
      {
        id: 'zalo_group_id',
        header: 'Nhóm Zalo',
        enableSorting: false,
        cell: ({ row }) => (
          <ZaloGroupCell
            vendor={row.original}
            groups={groups}
            testGroupId={testGroupId}
          />
        ),
      },
      {
        id: 'lifecycle',
        accessorFn: (n) => stateOf(n),
        header: 'Vòng đời',
        filterFn: (row, id, value: string[]) =>
          !value?.length || value.includes(row.getValue(id) as string),
        cell: ({ row }) => <LifecycleCell vendor={row.original} />,
      },
      {
        id: 'mapped',
        accessorFn: (n) => (n.zalo_group_id ? 'mapped' : 'unmapped'),
        header: () => null,
        cell: () => null,
        enableHiding: false,
        filterFn: (row, id, value: string[]) =>
          !value?.length || value.includes(row.getValue(id) as string),
      },
      {
        id: 'tags',
        header: 'Nhãn',
        enableSorting: false,
        cell: ({ row }) => {
          const tags = row.original.tags || []
          if (!tags.length) return <span className='text-muted-foreground'>—</span>
          return (
            <div className='flex flex-wrap gap-1'>
              {tags.map((t) => (
                <Badge key={t} variant='outline'>
                  #{t}
                </Badge>
              ))}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            variant='ghost'
            size='icon'
            aria-label='Sửa NCC'
            onClick={() => onEdit(row.original)}
          >
            <Pencil className='size-4' />
          </Button>
        ),
      },
    ],
    [groups, testGroupId, onEdit]
  )

  const table = useReactTable({
    data: vendors,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
    enableRowSelection: true,
    getRowId: (row) => row.ma_ncc,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const n = row.original
      const groupName = groups.find((g) => g.group_id === n.zalo_group_id)?.name || ''
      const hay = norm(
        [n.ten_ncc, n.ma_ncc, n.email, n.sdt, n.nhom_hang, groupName, n.dept_id, (n.tags || []).join(' ')].join(
          ' '
        )
      )
      const q = norm(filterValue)
      return !q || hay.includes(q)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const pendingCount = vendors.filter((n) => stateOf(n) === 'cho_duyet').length
  const newGroupsCount = data?.newGroups?.length ?? 0
  const nhomHangOptions = useMemo(
    () =>
      [...new Set(vendors.map((n) => n.nhom_hang).filter(Boolean))].map((t) => ({
        value: t as string,
        label: t as string,
      })),
    [vendors]
  )

  async function bulkChangeStatus(status: NccLifecycle) {
    const rows = table.getFilteredSelectedRowModel().rows
    if (!rows.length) return
    if (
      status === 'dang_dung' &&
      !window.confirm(
        `Duyệt ${rows.length} NCC sang ĐANG DÙNG?\nCác NCC này sẽ nhận tin khi ở chế độ GỬI THẬT.`
      )
    ) {
      return
    }
    setBulkChanging(true)
    let ok = 0
    let fail = 0
    for (const row of rows) {
      try {
        await statusMutation.mutateAsync({ ma: row.original.ma_ncc, status })
        ok++
      } catch {
        fail++
      }
    }
    setBulkChanging(false)
    table.resetRowSelection()
    toast.success(
      `Đã đổi ${ok} NCC → ${NCC_STATE_LABEL[status] || status}${fail ? ` · lỗi ${fail}` : ''}`
    )
  }

  function handlePullBase() {
    if (
      !window.confirm(
        'Kéo DANH BẠ NCC ĐẦY ĐỦ từ Base (quét toàn bộ đơn hàng)?\n- NCC mới tạo ở trạng thái CHỜ DUYỆT (không gửi tin)\n- KHÔNG đụng NCC / nhóm đã gán'
      )
    ) {
      return
    }
    pullMutation.mutate()
  }

  const me = data?.me
  const emptyMessage = !vendors.length
    ? me?.dept_id && !me.isSuper && !me.viewAll
      ? `Không có NCC nào trong phạm vi phòng ${me.dept_id}. Danh bạ NCC hiện thuộc phòng SCM — liên hệ SCM hoặc IT nếu bạn cần xem.`
      : 'Chưa có NCC nào. Bấm "Thêm NCC" để tạo.'
    : `Không có NCC khớp bộ lọc (${vendors.length} NCC bị lọc bỏ).`

  return (
    <div className='space-y-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Tìm NCC (tên / mã / email / sđt / nhóm)'
        filters={[
          {
            columnId: 'lifecycle',
            title: 'Vòng đời',
            options: NCC_STATES.map(([value, label]) => ({ value, label })),
          },
          { columnId: 'nhom_hang', title: 'Nhóm hàng', options: nhomHangOptions },
          {
            columnId: 'mapped',
            title: 'Gán nhóm Zalo',
            options: [
              { value: 'mapped', label: 'Đã gán' },
              { value: 'unmapped', label: 'Chưa gán' },
            ],
          },
        ]}
      />

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          {pendingCount > 0 && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => table.getColumn('lifecycle')?.setFilterValue(['cho_duyet'])}
            >
              <Users className='size-4' /> Duyệt NCC mới ({pendingCount})
            </Button>
          )}
          {isSuper && (
            <Button
              size='sm'
              variant='outline'
              disabled={pullMutation.isPending}
              onClick={handlePullBase}
            >
              <Download className='size-4' />
              {pullMutation.isPending ? 'Đang quét Base…' : 'Kéo NCC từ Base'}
            </Button>
          )}
          <Button size='sm' variant='outline' onClick={onBulkMap}>
            <Link2 className='size-4' /> Gán hàng loạt
            {newGroupsCount ? ` (${newGroupsCount})` : ''}
          </Button>
        </div>
        <Button size='sm' onClick={onAdd}>
          <Plus className='size-4' /> Thêm NCC
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className='h-24 text-center text-muted-foreground'
                >
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className='h-24 text-center text-muted-foreground'
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />

      <DataTableBulkActions table={table} entityName='NCC'>
        <Button
          size='sm'
          disabled={bulkChanging}
          onClick={() => bulkChangeStatus('dang_dung')}
        >
          Duyệt → Đang dùng
        </Button>
        <Button
          size='sm'
          variant='outline'
          disabled={bulkChanging}
          onClick={() => bulkChangeStatus('tam_dung')}
        >
          Tạm dừng
        </Button>
      </DataTableBulkActions>
    </div>
  )
}
