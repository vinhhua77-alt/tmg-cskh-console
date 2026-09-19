// NCC Hub v3 — Đặt hàng: dialog "Xem trước" 1 NCC (port hợp nhất detailPanel() desktop +
// sheetHtml() mobile của orders.js cũ — 1 Dialog responsive thay 2 UI khác nhau, cùng nội
// dung/hành động). Chỉ NCC sendable=true mới có ô hẹn giờ + nút Duyệt & gửi.
import { useEffect, useState } from 'react'
import { Clock, Send, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { NccState } from '@/hooks/use-ncc-state'
import type { OrderGroup } from '../types'
import { consolidate, whyCannotSend } from '../utils'

type Me = NccState['me']

type OrderPreviewDialogProps = {
  group: OrderGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  me: Me | undefined
  groupName: (groupId: string) => string
  onApprove: (g: OrderGroup) => void
  onSkip: (g: OrderGroup) => void
  onSchedule: (g: OrderGroup, epochMs: number) => void
}

export function OrderPreviewDialog({
  group,
  open,
  onOpenChange,
  me,
  groupName,
  onApprove,
  onSkip,
  onSchedule,
}: OrderPreviewDialogProps) {
  const [scheduledAt, setScheduledAt] = useState('')

  // reset ô hẹn giờ mỗi lần đổi NCC đang xem (tránh rò giá trị từ NCC trước)
  useEffect(() => {
    setScheduledAt('')
  }, [group?.key])

  if (!group) return null
  const why = whyCannotSend(me, group.ncc)

  function handleSchedule() {
    if (!group) return
    if (!scheduledAt) {
      toast.error('Chọn ngày giờ hẹn trước')
      return
    }
    const ms = new Date(scheduledAt).getTime()
    if (isNaN(ms)) {
      toast.error('Giờ hẹn không hợp lệ')
      return
    }
    if (ms <= Date.now()) {
      toast.error('Giờ hẹn phải ở tương lai')
      return
    }
    onSchedule(group, ms)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{group.ten_ncc}</DialogTitle>
          <DialogDescription>
            {group.cat.name} · {group.orders.length} đơn → gộp 1 tin
            {group.mapped && group.ncc?.zalo_group_id
              ? ` · → ${groupName(group.ncc.zalo_group_id)}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {!group.sendable && group.reason ? (
          <div className='flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'>
            <TriangleAlert className='size-4 shrink-0' />
            <span>{group.reason}</span>
          </div>
        ) : null}

        <div className='max-h-64 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap'>
          {consolidate(group.orders)}
        </div>

        {group.sendable ? (
          <div className='flex items-end gap-2'>
            <div className='flex-1 space-y-1.5'>
              <Label htmlFor='ord-sched-at'>Hẹn giờ gửi</Label>
              <Input
                id='ord-sched-at'
                type='datetime-local'
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <Button variant='outline' onClick={handleSchedule}>
              <Clock className='size-4' />
              Hẹn
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          {group.sendable ? (
            <>
              <Button variant='ghost' onClick={() => onSkip(group)}>
                Bỏ
              </Button>
              <Button disabled={!!why} title={why || undefined} onClick={() => onApprove(group)}>
                <Send className='size-4' />
                Duyệt &amp; gửi
              </Button>
            </>
          ) : (
            <Button variant='outline' onClick={() => onSkip(group)}>
              Bỏ {group.orders.length} đơn
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
