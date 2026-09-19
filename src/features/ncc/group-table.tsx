// NCC Hub v3 — sub-tab "Nhóm Zalo". Port hành vi thật từ admin/public/js/views/ncc.js
// (groupsVisible/groupCard/groupTable/classifyGroup/syncGroups) sang shadcn data-table.
import { useCallback, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useNccState } from '@/hooks/use-ncc-state'
import { useNccAuthStore } from '@/lib/ncc-auth'
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  GROUP_STATES,
  GROUP_STATE_LABEL,
  PURPOSES,
  PURPOSE_LABEL,
  UNSET,
  type Group,
  type Vendor,
  nccName,
  norm,
} from './data'
import { useClassifyGroupMutation, useSyncGroupsMutation } from './mutations'

function DeptCell({ group, options }: { group: Group; options: string[] }) {
  const mutation = useClassifyGroupMutation()
  const current = group.dept_id || ''
  return (
    <Select
      value={current || UNSET}
      onValueChange={(v) => {
        const val = v === UNSET ? '' : v
        mutation.mutate(
          { groupId: group.group_id, patch: { dept_id: val } },
          { onSuccess: () => toast.success(`Đã đổi phòng ban: ${val || 'chưa gán'}`) }
        )
      }}
    >
      <SelectTrigger size='sm' className='w-32'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((d) => (
          <SelectItem key={d || UNSET} value={d || UNSET}>
            {d || '— chưa gán —'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PurposeCell({ group }: { group: Group }) {
  const mutation = useClassifyGroupMutation()
  const current = group.purpose || ''
  return (
    <Select
      value={current || UNSET}
      onValueChange={(v) => {
        const val = v === UNSET ? '' : v
        mutation.mutate(
          { groupId: group.group_id, patch: { purpose: val } },
          { onSuccess: () => toast.success(`Mục đích: ${PURPOSE_LABEL[val] || 'chưa rõ'}`) }
        )
      }}
    >
      <SelectTrigger size='sm' className='w-36'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PURPOSES.map(([value, label]) => (
          <SelectItem key={value || UNSET} value={value || UNSET}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function GroupStatusCell({ group }: { group: Group }) {
  const mutation = useClassifyGroupMutation()
  const current = group.status || 'watch'
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        mutation.mutate(
          { groupId: group.group_id, patch: { status: v } },
          { onSuccess: () => toast.success(`Trạng thái: ${GROUP_STATE_LABEL[v] || v}`) }
        )
      }}
    >
      <SelectTrigger size='sm' className='w-36'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GROUP_STATES.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function GroupTable({ onGotoNcc }: { onGotoNcc: () => void }) {
  const { data, isLoading } = useNccState()
  const authUser = useNccAuthStore((s) => s.user)
  const syncMutation = useSyncGroupsMutation()

  const groups = useMemo(() => (data?.groups ?? []) as Group[], [data])
  const vendors = useMemo(() => (data?.ncc ?? []) as Vendor[], [data])
  const deptList = data?.deptList ?? []
  const testGroupId = data?.cfg?.test_group_id

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const nccNamesFor = useCallback(
    (gid: string) => vendors.filter((n) => n.zalo_group_id === gid).map(nccName).join(', '),
    [vendors]
  )

  const deptOptionsFor = useCallback(
    (g: Group) => {
      const fromServer = deptList.map((d) => d.dept_id).filter(Boolean)
      const list = authUser?.isSuper
        ? ['', ...(fromServer.length ? fromServer : ['SCM'])]
        : [authUser?.dept_id || 'SCM']
      if (g.dept_id && !list.includes(g.dept_id)) list.push(g.dept_id)
      return list
    },
    [deptList, authUser]
  )

  const columns = useMemo<ColumnDef<Group>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (g) => g.name || g.group_id,
        header: ({ column }) => <DataTableColumnHeader column={column} title='Nhóm Zalo' />,
        cell: ({ row }) => {
          const g = row.original
          const linked = nccNamesFor(g.group_id)
          return (
            <div>
              <div className='font-medium'>
                {g.name || g.group_id}
                {g.group_id === testGroupId && (
                  <Badge variant='outline' className='ms-2'>
                    nhóm THỬ
                  </Badge>
                )}
              </div>
              <div className='text-xs text-muted-foreground'>
                ID {g.group_id}
                {linked ? ` · ${linked}` : ''}
              </div>
            </div>
          )
        },
      },
      {
        id: 'dept_id',
        accessorFn: (g) => g.dept_id || '',
        header: 'Phòng ban',
        cell: ({ row }) => (
          <DeptCell group={row.original} options={deptOptionsFor(row.original)} />
        ),
      },
      {
        id: 'purpose',
        accessorFn: (g) => g.purpose || '',
        header: 'Mục đích',
        filterFn: (row, id, value: string[]) =>
          !value?.length || value.includes(row.getValue(id) as string),
        cell: ({ row }) => <PurposeCell group={row.original} />,
      },
      {
        id: 'status',
        accessorFn: (g) => g.status || 'watch',
        header: 'Trạng thái',
        filterFn: (row, id, value: string[]) =>
          !value?.length || value.includes(row.getValue(id) as string),
        cell: ({ row }) => <GroupStatusCell group={row.original} />,
      },
    ],
    [deptOptionsFor, nccNamesFor, testGroupId]
  )

  const table = useReactTable({
    data: groups,
    columns,
    state: { sorting, columnFilters, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
    getRowId: (g) => g.group_id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const g = row.original
      const hay = norm([g.name, g.group_id, g.dept_id, PURPOSE_LABEL[g.purpose || '']].join(' '))
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

  const watchCount = groups.filter((g) => (g.status || 'watch') === 'watch').length
  const newGroupsCount = data?.newGroups?.length ?? 0

  function handleSync() {
    if (!window.confirm('Đồng bộ danh sách nhóm từ gateway Zalo?')) return
    syncMutation.mutate()
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <DataTableToolbar
          table={table}
          searchPlaceholder='Tìm nhóm (tên / ID / phòng ban)'
          filters={[
            {
              columnId: 'status',
              title: 'Trạng thái',
              options: GROUP_STATES.map(([value, label]) => ({ value, label })),
            },
            {
              columnId: 'purpose',
              title: 'Mục đích',
              options: PURPOSES.filter(([value]) => value).map(([value, label]) => ({
                value,
                label,
              })),
            },
          ]}
        />
        {authUser?.isSuper && (
          <Button size='sm' variant='outline' disabled={syncMutation.isPending} onClick={handleSync}>
            <RefreshCw className='size-4' />
            {syncMutation.isPending ? 'Đang đồng bộ…' : 'Đồng bộ nhóm'}
          </Button>
        )}
      </div>

      {newGroupsCount > 0 && (
        <div className='rounded-md border bg-muted/40 px-3 py-2 text-sm'>
          {newGroupsCount} nhóm Zalo mới chưa gán NCC.{' '}
          <button type='button' className='underline' onClick={onGotoNcc}>
            Sang tab NCC để gán hàng loạt →
          </button>
        </div>
      )}
      {watchCount > 0 && (
        <p className='text-sm text-muted-foreground'>
          {watchCount} nhóm chờ phân loại — chọn phòng ban / mục đích, rồi chuyển sang Đang
          dùng hoặc Lưu trữ.
        </p>
      )}

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
                <TableRow key={row.id}>
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
                  {groups.length ? 'Không có nhóm khớp bộ lọc.' : 'Chưa có nhóm nào.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}
