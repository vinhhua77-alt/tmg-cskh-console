// NCC Hub v3 — section "Sức khỏe nick": gateway/phiên/hạn mức + chi tiết SIM/tài khoản.
// KPI tổng quan đã có ở Dashboard — section này giữ chi tiết vận hành gateway thật (session,
// uptime, transport bot/nick) mà Dashboard không hiện, để không mất thông tin.
// Port từ secHealth()/refreshHealth()/fmtUptime() trong admin/public/js/views/settings.js.
import { Link } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useGatewayHealth, useNccState, type NccHealth } from '@/hooks/use-ncc-state'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ContentSection } from '@/features/settings/components/content-section'
import { fmtNum, fmtUptime } from '../lib/helpers'

// Gateway thật trả thêm session/transport/uptime_s ngoài {ok} — NccHealth khai hẹp vì
// use-ncc-state.ts dùng chung cho mọi trang; mở rộng cục bộ ở đây thay vì sửa hook chung.
interface GatewayInfo extends NonNullable<NccHealth['gateway']> {
  transport?: 'bot' | 'nick' | string
  uptime_s?: number
}

const SESSION_LABEL: Record<string, string> = {
  alive: 'Đang hoạt động',
  'not-logged-in': 'Chưa đăng nhập',
}

function HealthTile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div
        className={cn(
          'mt-1 text-lg font-semibold',
          tone === 'ok' && 'text-chart-3',
          tone === 'bad' && 'text-destructive'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium'>{value}</span>
    </div>
  )
}

export function SettingsHealth() {
  const { data } = useNccState()
  const { data: health, isFetching, refetch } = useGatewayHealth()

  const gw = health?.gateway as GatewayInfo | undefined
  const ok = !!gw?.ok
  const sessTxt = gw
    ? SESSION_LABEL[gw.session ?? ''] || gw.session || (ok ? 'sống' : 'mất')
    : 'đang kiểm tra…'
  const uptime = gw && Number.isFinite(gw.uptime_s) ? fmtUptime(gw.uptime_s as number) : '—'
  const stats = data?.stats ?? { today: 0, minute: 0, queue: 0, quiet: false }
  const max = Number(data?.cfg?.zalo_max_per_day) || 200
  const emailOk = health ? !!health.email : null

  return (
    <ContentSection title='Sức khỏe nick' desc='Gateway · phiên · hạn mức ngày'>
      <div className='space-y-6'>
        <p className='text-muted-foreground text-sm'>
          Xem thêm chỉ số vận hành tổng quan ở{' '}
          <Link to='/' className='underline'>
            Trang chủ
          </Link>
          .
        </p>

        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <HealthTile label='Gateway Zalo' value={ok ? 'Sống' : 'Mất'} tone={ok ? 'ok' : 'bad'} />
          <HealthTile label='Phiên (session)' value={sessTxt} tone={ok ? 'ok' : 'bad'} />
          <HealthTile label='Thời gian chạy' value={uptime} />
          <HealthTile label='Hạn mức hôm nay' value={`${fmtNum(stats.today || 0)}/${fmtNum(max)}`} />
        </div>

        <div>
          <h4 className='mb-3 text-sm font-medium'>Chi tiết</h4>
          <div className='space-y-2 text-sm'>
            <Row label='Đang trong hàng đợi' value={fmtNum(stats.queue || 0)} />
            <Row label='Số NCC quản lý' value={fmtNum(data?.ncc.length ?? 0)} />
            <Row label='Số nhóm Zalo' value={fmtNum(data?.groups.length ?? 0)} />
            <Row
              label='Kênh email'
              value={emailOk === null ? '—' : emailOk ? 'đã cấu hình' : 'chưa cấu hình'}
            />
          </div>
        </div>

        {!ok && (
          <p className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm'>
            {gw?.transport === 'bot' ? (
              <>
                <b>Bot Zalo mất kết nối.</b> Kiểm tra token/webhook trên máy chủ gateway (
                <code>gateway/bot-server.js</code>), xem log để biết chi tiết. Trong lúc chờ,
                mọi việc gửi sẽ thất bại — xử lý đơn gấp thủ công.
              </>
            ) : (
              <>
                <b>Nick Zalo mất kết nối.</b> Phiên đăng nhập có thể đã hết hạn. Cần đăng nhập
                lại số phụ bằng QR trên máy chủ gateway: chạy <code>node gateway/login.js</code>{' '}
                rồi quét QR. Trong lúc chờ, mọi việc gửi sẽ thất bại — xử lý đơn gấp thủ công.
              </>
            )}
          </p>
        )}

        <Button variant='outline' size='sm' onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          Kiểm tra lại
        </Button>
      </div>
    </ContentSection>
  )
}
