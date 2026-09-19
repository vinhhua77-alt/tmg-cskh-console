// NCC Hub v3 — section "Nhật ký": send_log (lọc + xuất CSV + gửi lại) + audit_log (super_admin).
// Port từ secLog()/resend()/exportCsv() trong admin/public/js/views/settings.js.
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { nccApi } from '@/lib/ncc-api'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { useNccState } from '@/hooks/use-ncc-state'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContentSection } from '@/features/settings/components/content-section'
import { fmtDateTime, fmtTime, getErrMsg } from '../lib/helpers'
import type { NccAuditEntry, NccLogEntry } from '../types'

type LogFilter = '' | 'today' | 'err'
const LOG_FILTERS: { key: LogFilter; label: string }[] = [
  { key: '', label: 'Tất cả' },
  { key: 'today', label: 'Hôm nay' },
  { key: 'err', label: 'Lỗi' },
]

function formatAuditDetail(a: NccAuditEntry): string {
  let detail: unknown = a.detail
  if (typeof a.detail === 'string') {
    try {
      detail = JSON.parse(a.detail)
    } catch {
      return a.detail || a.target || ''
    }
  }
  if (detail && typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>)
      .map(([k, v]) => {
        if (v && typeof v === 'object' && 'to' in (v as object)) {
          const vv = v as { from?: unknown; to?: unknown }
          return `${k}: ${vv.from ?? ''}→${vv.to ?? ''}`
        }
        return `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`
      })
      .join('; ')
  }
  return a.target || ''
}

function exportCsv(rows: NccLogEntry[]) {
  const head = 'gio,loai,kenh,ma_ncc,target,status,message_id,error'
  const body = rows
    .map((l) =>
      [l.sent_at, l.loai, l.kenh, l.ma_ncc, l.target, l.status, l.message_id, (l.error || '').replace(/[\n,]/g, ' ')]
        .map((x) => `"${(x == null ? '' : String(x)).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')
  const csv = head + '\n' + body
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = 'nhatky_ncc.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export function SettingsLog() {
  const { data } = useNccState()
  const isSuper = useNccAuthStore((s) => s.user?.isSuper) ?? false
  const qc = useQueryClient()
  const [filter, setFilter] = useState<LogFilter>('')

  const log = (data?.log as NccLogEntry[] | undefined) ?? []
  const audit = (data?.audit as NccAuditEntry[] | undefined) ?? []
  const testGroupId = data?.cfg?.test_group_id

  const today = new Date().toISOString().slice(0, 10)
  const filtered = log.filter((l) => {
    if (filter === 'err') return l.status !== 'sent'
    if (filter === 'today') return (l.sent_at || '').slice(0, 10) === today
    return true
  })

  const resend = useMutation({
    mutationFn: (id: number) => nccApi.post(`/resend/${id}`, {}),
    onSuccess: () => {
      toast.success('Đã đưa lại vào hàng đợi')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
    },
    onError: (e) => toast.error(getErrMsg(e, 'Gửi lại lỗi')),
  })

  return (
    <ContentSection title='Nhật ký' desc='Lịch sử gửi & hành động'>
      <div className='space-y-8'>
        <div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex gap-1'>
              {LOG_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  size='sm'
                  variant={filter === f.key ? 'default' : 'outline'}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className='flex items-center gap-3'>
              <span className='text-muted-foreground text-sm'>
                {filtered.length} dòng (40 gần nhất)
              </span>
              <Button size='sm' variant='outline' onClick={() => exportCsv(log)}>
                <Download className='size-4' />
                Xuất CSV
              </Button>
            </div>
          </div>

          <div className='mt-3 rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Giờ</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>NCC</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className='text-right'>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-muted-foreground text-center'>
                      Chưa có nhật ký gửi.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{fmtTime(l.sent_at)}</TableCell>
                      <TableCell>
                        {l.loai} <Badge variant='outline'>{l.kenh || 'zalo'}</Badge>
                      </TableCell>
                      <TableCell>
                        {l.ma_ncc}
                        {l.target && l.target === testGroupId && (
                          <span className='text-muted-foreground'> →thử</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.status === 'sent' ? (
                          <Badge className='bg-chart-3 text-white'>đã gửi</Badge>
                        ) : (
                          <Badge variant='destructive'>lỗi</Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        {l.status !== 'sent' && (
                          <Button
                            size='sm'
                            variant='ghost'
                            disabled={resend.isPending}
                            onClick={() => resend.mutate(l.id)}
                          >
                            Gửi lại
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {isSuper && (
          <div>
            <h4 className='mb-1 text-sm font-medium'>Nhật ký hành động (audit)</h4>
            <p className='text-muted-foreground mb-3 text-sm'>
              Đổi cấu hình, chuyển chế độ gửi, tạm dừng… ai làm — khi nào.
            </p>
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lúc</TableHead>
                    <TableHead>Người</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className='text-muted-foreground text-center'>
                        Chưa có hành động nhạy cảm nào.
                      </TableCell>
                    </TableRow>
                  ) : (
                    audit.map((a) => {
                      const detailTxt = formatAuditDetail(a)
                      return (
                        <TableRow key={a.id}>
                          <TableCell className='whitespace-nowrap'>{fmtDateTime(a.ts)}</TableCell>
                          <TableCell>{a.email}</TableCell>
                          <TableCell className='font-medium'>{a.action}</TableCell>
                          <TableCell
                            className={cn('max-w-96 truncate text-muted-foreground')}
                            title={detailTxt}
                          >
                            {detailTxt}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </ContentSection>
  )
}
