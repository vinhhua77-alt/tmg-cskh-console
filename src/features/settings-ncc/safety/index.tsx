// NCC Hub v3 — section "An toàn": Thử/Thật/Tạm dừng + chống spam + giờ im lặng.
// Port từ secSafe()/setMode()/goLive()/togglePanic()/setCfgNum() trong
// admin/public/js/views/settings.js. POST /api/config — super_admin ONLY (backend audit + 403).
import { useState } from 'react'
import { toast } from 'sonner'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { useNccState } from '@/hooks/use-ncc-state'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ContentSection } from '@/features/settings/components/content-section'
import { useSetConfig } from '../hooks/use-set-config'
import { fmtNum, modeOf } from '../lib/helpers'

const MODE_LABEL = { paused: 'Đã tạm dừng', test: 'Chế độ THỬ', live: 'GỬI THẬT' } as const
const MODE_DESC = {
  paused: 'Mọi việc gửi đang tạm dừng để bảo vệ SIM.',
  test: 'Mọi tin về nhóm TMG-BOT. NCC thật KHÔNG nhận gì.',
  live: 'Tin sẽ tới nhà cung cấp THẬT. Cẩn trọng.',
} as const
const MODE_DOT = {
  paused: 'bg-muted-foreground',
  test: 'bg-chart-4',
  live: 'bg-destructive',
} as const
const MODE_BG = {
  paused: 'bg-muted/50 border-border',
  test: 'bg-chart-4/10 border-chart-4/30',
  live: 'bg-destructive/10 border-destructive/30',
} as const

const SPAM_NUMBER_FIELDS: { key: string; label: string }[] = [
  { key: 'zalo_max_per_day', label: 'Tối đa mỗi ngày' },
  { key: 'zalo_max_per_min', label: 'Tối đa mỗi phút' },
  { key: 'group_max_per_day', label: 'Mỗi nhóm / ngày' },
]

export function SettingsSafety() {
  const { data } = useNccState()
  const isSuper = useNccAuthStore((s) => s.user?.isSuper) ?? false
  const setConfig = useSetConfig()
  const [liveConfirmText, setLiveConfirmText] = useState('')
  const [liveDialogOpen, setLiveDialogOpen] = useState(false)

  const cfg = data?.cfg ?? {}
  const stats = data?.stats ?? { today: 0, minute: 0, queue: 0, quiet: false }
  const mode = modeOf(cfg)

  const max = Number(cfg.zalo_max_per_day) || 200
  const today = stats.today || 0
  const pct = Math.min(100, Math.round((today / Math.max(1, max)) * 100))
  const barTone = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-chart-4' : 'bg-chart-3'

  function setMode(toTest: boolean) {
    setConfig.mutate(
      { test_mode: toTest ? '1' : '0', mode_changed_at: new Date().toISOString() },
      {
        onSuccess: () =>
          toast.success(toTest ? 'Đã về chế độ THỬ' : 'Đã chuyển GỬI THẬT'),
      }
    )
  }
  function togglePanic() {
    const paused = mode === 'paused'
    setConfig.mutate(
      { paused: paused ? '0' : '1' },
      { onSuccess: () => toast.success(paused ? 'Đã tiếp tục gửi' : 'Đã dừng mọi gửi') }
    )
  }
  function saveNumber(key: string, value: string) {
    if (value === (cfg[key] ?? '')) return
    setConfig.mutate({ [key]: value }, { onSuccess: () => toast.success('Đã lưu') })
  }

  return (
    <ContentSection title='An toàn' desc='Thử / Thật / Tạm dừng · giờ im lặng · chống spam'>
      <div className='space-y-6'>
        <div className={cn('flex items-center gap-3 rounded-lg border p-4', MODE_BG[mode])}>
          <span className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', MODE_DOT[mode])} />
          <div>
            <div className='font-semibold'>{MODE_LABEL[mode]}</div>
            <div className='text-muted-foreground text-sm'>{MODE_DESC[mode]}</div>
          </div>
        </div>

        {isSuper ? (
          <div className='flex flex-wrap gap-2'>
            {mode === 'test' ? (
              <AlertDialog
                open={liveDialogOpen}
                onOpenChange={(o) => {
                  setLiveDialogOpen(o)
                  if (!o) setLiveConfirmText('') // đóng bằng cách nào cũng dọn sạch ô gõ (Cancel/Action/Escape/click ngoài)
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant='destructive'>Chuyển sang GỬI THẬT…</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cảnh báo: chuyển sang GỬI THẬT</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tin sẽ tới nhà cung cấp thật. Gõ chính xác <b>GUI THAT</b> để xác nhận.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    autoFocus
                    value={liveConfirmText}
                    onChange={(e) => setLiveConfirmText(e.target.value)}
                    placeholder='GUI THAT'
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Huỷ</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={liveConfirmText.trim().toUpperCase() !== 'GUI THAT'}
                      onClick={() => setMode(false)}
                    >
                      Xác nhận GỬI THẬT
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button onClick={() => setMode(true)}>Về chế độ THỬ (an toàn)</Button>
            )}

            {mode === 'paused' ? (
              <Button variant='outline' onClick={togglePanic}>
                Bỏ tạm dừng
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='outline'
                    className='border-chart-4 text-chart-4 hover:bg-chart-4/10'
                  >
                    Dừng mọi gửi
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tạm dừng toàn bộ gửi Zalo/Email?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Bảo vệ SIM — có thể bật lại bất cứ lúc nào.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Huỷ</AlertDialogCancel>
                    <AlertDialogAction onClick={togglePanic}>Tạm dừng</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : (
          <p className='text-muted-foreground rounded-md border p-3 text-sm'>
            Chỉ <b>super_admin</b> được đổi chế độ gửi / tạm dừng. Hệ thống đang ở chế độ{' '}
            <b>{MODE_LABEL[mode]}</b>. Liên hệ quản trị nếu cần đổi.
          </p>
        )}

        <div>
          <h4 className='mb-3 text-sm font-medium'>Đồng hồ hôm nay</h4>
          <div className='space-y-2 text-sm'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Đã gửi Zalo</span>
              <span className='font-medium'>
                {fmtNum(today)} / {fmtNum(max)}
              </span>
            </div>
            <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
              <div className={cn('h-full rounded-full transition-all', barTone)} style={{ width: `${pct}%` }} />
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Trong hàng đợi</span>
              <span className='font-medium'>{fmtNum(stats.queue || 0)}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>
                Giờ im lặng ({cfg.quiet_start ?? '21'}h–{cfg.quiet_end ?? '7'}h)
              </span>
              <span className='font-medium'>
                {stats.quiet ? 'đang im lặng' : 'đang trong giờ gửi'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 className='mb-1 text-sm font-medium'>Giới hạn chống spam (bảo vệ SIM — toàn cục)</h4>
          <p className='text-muted-foreground mb-3 text-sm'>
            {isSuper ? 'Lưu ngay khi rời khỏi ô.' : 'Chỉ super_admin sửa được.'}
          </p>
          <div className='grid gap-4 sm:grid-cols-2'>
            {SPAM_NUMBER_FIELDS.map(({ key, label }) => (
              <div key={key} className='space-y-1.5'>
                <Label>{label}</Label>
                <Input
                  type='number'
                  min={0}
                  disabled={!isSuper}
                  defaultValue={cfg[key] ?? ''}
                  onBlur={(e) => saveNumber(key, e.target.value)}
                />
              </div>
            ))}
            <div className='space-y-1.5'>
              <Label>Giãn cách giữa tin (giây)</Label>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  min={0}
                  disabled={!isSuper}
                  defaultValue={cfg.zalo_min_gap_sec ?? ''}
                  onBlur={(e) => saveNumber('zalo_min_gap_sec', e.target.value)}
                />
                <span className='text-muted-foreground'>–</span>
                <Input
                  type='number'
                  min={0}
                  disabled={!isSuper}
                  defaultValue={cfg.zalo_max_gap_sec ?? ''}
                  onBlur={(e) => saveNumber('zalo_max_gap_sec', e.target.value)}
                />
              </div>
            </div>
            <div className='space-y-1.5'>
              <Label>Giờ im lặng (không gửi)</Label>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  min={0}
                  max={23}
                  disabled={!isSuper}
                  defaultValue={cfg.quiet_start ?? '21'}
                  onBlur={(e) => saveNumber('quiet_start', e.target.value)}
                />
                <span className='text-muted-foreground'>h –</span>
                <Input
                  type='number'
                  min={0}
                  max={23}
                  disabled={!isSuper}
                  defaultValue={cfg.quiet_end ?? '7'}
                  onBlur={(e) => saveNumber('quiet_end', e.target.value)}
                />
                <span className='text-muted-foreground'>h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ContentSection>
  )
}
