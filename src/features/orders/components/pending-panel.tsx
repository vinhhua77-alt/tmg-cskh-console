// NCC Hub v3 — Đặt hàng / tab "Chờ duyệt" (TRỌNG TÂM). Port pendBody() + segBar's phần
// "cho_duyet" + toàn bộ hành động (approveNcc/skipNcc/scheduleNcc/approveSelected/relink/
// skipAllStale/skipStaleNcc/sendStaleNcc) từ admin/public/js/views/orders.js.
// BẤT BIẾN (giữ nguyên, KHÔNG đổi): chỉ NCC status='dang_dung' + đã gán nhóm Zalo mới gửi
// được — backend (routes/pending.js gateNcc) cũng chặn, ở đây chỉ làm UI mờ + nói lý do.
import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { Inbox, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTableBulkActions,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { NccState } from '@/hooks/use-ncc-state'
import { cn } from '@/lib/utils'
import { useApproveBatch, useRelink, useScheduleSend, useSkipOrders } from '../mutations'
import type { NccRow, OrderGroup, PendingOrderRow } from '../types'
import {
  canApprove,
  consolidate,
  groupPending,
  isViewOnly,
  nccActive,
  sortStoreKeys,
  stalePending,
  storeCounts,
  storeLabel,
} from '../utils'
import { OrderPreviewDialog } from './order-preview-dialog'
import { buildPendingColumns } from './pending-columns'
import { StaleOrdersSection } from './stale-orders-section'

type ConfirmState = {
  title: string
  desc: string
  onConfirm: () => void | Promise<void>
}

type PendingPanelProps = {
  pending: PendingOrderRow[]
  nccList: NccRow[]
  groups: NccState['groups']
  me: NccState['me'] | undefined
  cfg: Record<string, string>
}

export function PendingPanel({ pending, nccList, groups, me, cfg }: PendingPanelProps) {
  const [storeFilter, setStoreFilter] = useState('')
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const approveBatch = useApproveBatch()
  const skipOrders = useSkipOrders()
  const scheduleSend = useScheduleSend()
  const relink = useRelink()

  const filteredGroups = useMemo(
    () => groupPending(pending, nccList, storeFilter),
    [pending, nccList, storeFilter]
  )
  const staleGroups = useMemo(() => stalePending(pending, nccList), [pending, nccList])
  const sc = useMemo(() => storeCounts(pending), [pending])
  const storeKeys = useMemo(() => sortStoreKeys(Object.keys(sc)), [sc])
  const groupName = (gid: string) => groups.find((g) => g.group_id === gid)?.name || gid

  const previewGroup = previewKey ? filteredGroups.find((g) => g.key === previewKey) ?? null : null
  const sendableCount = filteredGroups.filter((g) => g.sendable).length
  const blockedCount = filteredGroups.length - sendableCount

  // Không memo: bảng gồm vài chục NCC là cùng, dựng lại columns mỗi render tránh luôn
  // được bẫy closure cũ trỏ về pending/nccList đã lỗi thời (đổi lại rẻ hơn debug sau này).
  const columns = buildPendingColumns({
    me,
    groupName,
    onPreview: (g) => setPreviewKey(g.key),
    onApprove: (g) => approveGroup(g),
    onSkip: (g) => askSkipGroup(g),
  })

  const table = useReactTable({
    data: filteredGroups,
    columns,
    getRowId: (row) => row.key,
    state: { sorting, columnFilters, pagination, rowSelection },
    enableRowSelection: (row) => row.original.sendable,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  async function approveGroup(g: OrderGroup) {
    if (!g.sendable) {
      toast.error(g.reason || 'NCC chưa đủ điều kiện gửi')
      return
    }
    try {
      const r = await approveBatch.mutateAsync([
        { ma_ncc: g.ma_ncc, ids: g.orders.map((o) => o.id), message: consolidate(g.orders) },
      ])
      if (r.sent) toast.success(`Đã duyệt → hàng đợi (gộp ${g.orders.length} đơn)`)
      else toast.error(r.skipped[0] ? `Bỏ qua: ${r.skipped[0]}` : 'Không gửi được')
      setPreviewKey(null)
    } catch {
      toast.error('Lỗi kết nối — thử lại')
    }
  }

  function askSkipGroup(g: OrderGroup) {
    setConfirmState({
      title: 'Bỏ qua đơn?',
      desc: `Bỏ qua ${g.orders.length} đơn của "${g.ten_ncc}"? (không gửi)`,
      onConfirm: async () => {
        try {
          await skipOrders.mutateAsync(g.orders.map((o) => o.id))
          toast.success(`Đã bỏ ${g.orders.length} đơn`)
          setPreviewKey(null)
        } catch {
          toast.error('Lỗi kết nối — thử lại')
        }
        setConfirmState(null)
      },
    })
  }

  async function scheduleGroup(g: OrderGroup, epochMs: number) {
    if (!g.sendable) {
      toast.error(g.reason || 'NCC chưa đủ điều kiện gửi')
      return
    }
    try {
      const r = await scheduleSend.mutateAsync({
        ma_ncc: g.ma_ncc,
        text: consolidate(g.orders),
        scheduledAtMs: epochMs,
        orderIds: g.orders.map((o) => o.id),
      })
      if (r.queued) {
        const when = new Date(epochMs).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        })
        toast.success(`Đã hẹn gửi lúc ${when}`)
        setPreviewKey(null)
      } else {
        toast.error(r.skipped[0] ? `Bỏ qua: ${r.skipped[0]}` : 'Không hẹn được')
      }
    } catch {
      toast.error('Lỗi kết nối — thử lại')
    }
  }

  function approveSelected() {
    const rows = table
      .getFilteredSelectedRowModel()
      .rows.map((r) => r.original)
      .filter((g) => g.sendable)
    if (!rows.length) {
      toast.error('Chưa chọn NCC nào gửi được')
      return
    }
    const payload = rows.map((g) => ({
      ma_ncc: g.ma_ncc,
      ids: g.orders.map((o) => o.id),
      message: consolidate(g.orders),
    }))
    const test = cfg.test_mode === '1'
    setConfirmState({
      title: 'Duyệt & gửi hàng loạt?',
      desc: `Duyệt & gửi ${payload.length} NCC${test ? ' — đang THỬ → TMG-BOT' : ' — GỬI THẬT tới NCC'}?`,
      onConfirm: async () => {
        try {
          const r = await approveBatch.mutateAsync(payload)
          const skip = r.skipped.length ? ` · bỏ ${r.skipped.length}` : ''
          toast.success(`Đã duyệt ${r.sent || 0} NCC → hàng đợi${skip}`)
          table.resetRowSelection()
        } catch {
          toast.error('Lỗi kết nối — thử lại')
        }
        setConfirmState(null)
      },
    })
  }

  function askSendStale(g: OrderGroup) {
    const can = nccActive(g.ncc) && !!g.ncc?.zalo_group_id
    if (!can) {
      toast.error('NCC chưa đủ điều kiện gửi')
      return
    }
    const test = cfg.test_mode === '1'
    setConfirmState({
      title: 'Gửi lại đơn quá ngày?',
      desc: `Gửi lại ${g.orders.length} đơn quá ngày cho "${g.ten_ncc}"${test ? ' (đang THỬ)' : ' — GỬI THẬT'}?`,
      onConfirm: async () => {
        try {
          const r = await approveBatch.mutateAsync([
            { ma_ncc: g.ma_ncc, ids: g.orders.map((o) => o.id), message: consolidate(g.orders) },
          ])
          if (r.sent) toast.success(`Đã duyệt → hàng đợi (gộp ${g.orders.length} đơn)`)
          else toast.error(r.skipped[0] ? `Bỏ qua: ${r.skipped[0]}` : 'Không gửi được')
        } catch {
          toast.error('Lỗi kết nối — thử lại')
        }
        setConfirmState(null)
      },
    })
  }

  function askSkipStale(g: OrderGroup) {
    setConfirmState({
      title: 'Đánh dấu đã xử lý?',
      desc: `Đánh dấu ${g.orders.length} đơn quá ngày của "${g.ten_ncc}" là đã xử lý?`,
      onConfirm: async () => {
        try {
          await skipOrders.mutateAsync(g.orders.map((o) => o.id))
          toast.success('Đã xử lý')
        } catch {
          toast.error('Lỗi kết nối — thử lại')
        }
        setConfirmState(null)
      },
    })
  }

  function askSkipAllStale() {
    const ids = staleGroups.flatMap((g) => g.orders.map((o) => o.id))
    if (!ids.length) return
    setConfirmState({
      title: 'Đánh dấu tất cả đã xử lý?',
      desc: `Đánh dấu TẤT CẢ ${ids.length} đơn quá ngày là đã xử lý (không gửi)?`,
      onConfirm: async () => {
        try {
          await skipOrders.mutateAsync(ids)
          toast.success(`Đã xử lý ${ids.length} đơn quá ngày`)
        } catch {
          toast.error('Lỗi kết nối — thử lại')
        }
        setConfirmState(null)
      },
    })
  }

  async function relinkNcc() {
    try {
      const r = await relink.mutateAsync()
      if (r.linked) toast.success(`Đã khớp thêm ${r.linked} NCC${r.remaining ? ` · còn ${r.remaining}` : ''}`)
      else toast.error('Không khớp được — sang NCC & Nhóm gán thủ công')
    } catch {
      toast.error('Lỗi kết nối — thử lại')
    }
  }

  const totalRaw = pending.length
  const isEmpty = !filteredGroups.length && !staleGroups.length

  return (
    <div className='flex flex-1 flex-col gap-4'>
      {isViewOnly(me) ? (
        <div className='rounded-md border bg-muted/40 px-3 py-2 text-sm'>
          Bạn đang ở <b>chế độ chỉ xem</b> (phòng {me?.dept_id || '—'}). Duyệt và gửi đơn thuộc
          phòng chủ quản (SCM).
        </div>
      ) : null}

      {storeKeys.length > 1 ? (
        <div className='flex flex-wrap gap-2'>
          <Button
            variant={storeFilter === '' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setStoreFilter('')}
          >
            Tất cả
          </Button>
          {storeKeys.map((k) => (
            <Button
              key={k}
              variant={storeFilter === k ? 'default' : 'outline'}
              size='sm'
              onClick={() => setStoreFilter(k)}
            >
              {storeLabel(k)} <span className='ms-1 opacity-70'>{sc[k]}</span>
            </Button>
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border py-16 text-center'>
          <Inbox className='size-8 text-muted-foreground' />
          {storeFilter ? (
            <>
              <p className='text-sm text-muted-foreground'>
                Không có đơn nào của <b>{storeLabel(storeFilter)}</b>.
              </p>
              <Button variant='outline' size='sm' onClick={() => setStoreFilter('')}>
                Xem tất cả nhà hàng
              </Button>
            </>
          ) : totalRaw === 0 && me?.dept_id && !me.isSuper && !me.viewAll ? (
            <p className='text-sm text-muted-foreground'>
              Không có đơn nào trong phạm vi phòng <b>{me.dept_id}</b>.
              <br />
              Đơn đặt hàng hiện thuộc phòng SCM — liên hệ SCM hoặc IT nếu bạn cần xem.
            </p>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Không có đơn chờ duyệt.
              <br />
              Poller Base sẽ tự đưa đơn mới về đây.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <DataTableToolbar table={table} searchKey='ten_ncc' searchPlaceholder='Tìm theo tên NCC…' />
            {blockedCount > 0 ? (
              <Button variant='outline' size='sm' onClick={relinkNcc} disabled={relink.isPending}>
                <RefreshCw className='size-4' />
                Khớp lại
              </Button>
            ) : null}
          </div>
          <p className='-mt-2 text-sm text-muted-foreground'>
            {filteredGroups.length} NCC · {sendableCount} gửi được
            {blockedCount ? ` · ${blockedCount} chờ điều kiện` : ''}
          </p>

          <div className={cn('overflow-hidden rounded-md border', 'max-sm:has-[div[role="toolbar"]]:mb-16')}>
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
                {table.getRowModel().rows.length ? (
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
                    <TableCell colSpan={columns.length} className='h-24 text-center'>
                      Không có NCC khớp bộ lọc.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} className='mt-auto' />
          <DataTableBulkActions table={table} entityName='NCC'>
            <Button
              size='sm'
              disabled={!canApprove(me)}
              title={!canApprove(me) ? 'Chỉ quản lý trở lên mới được duyệt/gửi' : undefined}
              onClick={approveSelected}
            >
              <Send className='size-4' />
              Duyệt &amp; gửi {table.getFilteredSelectedRowModel().rows.length} NCC
            </Button>
          </DataTableBulkActions>
        </>
      )}

      <StaleOrdersSection
        groups={staleGroups}
        onSendStale={askSendStale}
        onSkipStale={askSkipStale}
        onSkipAllStale={askSkipAllStale}
      />

      <OrderPreviewDialog
        group={previewGroup}
        open={!!previewGroup}
        onOpenChange={(v) => !v && setPreviewKey(null)}
        me={me}
        groupName={groupName}
        onApprove={approveGroup}
        onSkip={askSkipGroup}
        onSchedule={scheduleGroup}
      />

      <ConfirmDialog
        open={!!confirmState}
        onOpenChange={(v) => !v && setConfirmState(null)}
        title={confirmState?.title ?? ''}
        desc={confirmState?.desc ?? ''}
        confirmText='Xác nhận'
        cancelBtnText='Huỷ'
        handleConfirm={confirmState?.onConfirm ?? (() => {})}
      />
    </div>
  )
}
