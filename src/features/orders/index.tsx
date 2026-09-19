// NCC Hub v3 — Đặt hàng (Orders), trang thật. Port admin/public/js/views/orders.js (Chờ
// duyệt/Đã gửi/Lỗi) chạy trên admin/routes/pending.js — behavior parity, KHÔNG phải viết
// lại từ đầu. Dữ liệu đọc qua useNccState() (đã có pending/ncc/groups/cfg/me), hành động
// qua mutations.ts (approve-batch/skip/send/relink).
import { useMemo } from 'react'
import { useNccState } from '@/hooks/use-ncc-state'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FailedPanel } from './components/failed-panel'
import { PendingPanel } from './components/pending-panel'
import { SentPanel } from './components/sent-panel'
import type { NccRow, PendingOrderRow, SendLogRow, SendQueueRow } from './types'
import { failedItems, groupPending, sentItems } from './utils'

export function Orders() {
  const { data, isLoading, isError, dataUpdatedAt } = useNccState()

  // useNccState() dùng chung cho mọi trang nên trả type rộng (unknown[]/index signature) —
  // ép lại về shape thật đọc từ admin/db.js (types.ts) để làm việc có kiểu trong feature này.
  const pending = useMemo(() => (data?.pending ?? []) as unknown as PendingOrderRow[], [data])
  const nccList = useMemo(() => (data?.ncc ?? []) as unknown as NccRow[], [data])
  const queue = useMemo(() => (data?.queue ?? []) as unknown as SendQueueRow[], [data])
  const log = useMemo(() => (data?.log ?? []) as unknown as SendLogRow[], [data])
  const groups = data?.groups ?? []
  const me = data?.me
  const cfg = data?.cfg ?? {}

  const pendingCount = useMemo(() => groupPending(pending, nccList, '').length, [pending, nccList])
  const sent = useMemo(() => sentItems(queue, log, nccList), [queue, log, nccList])
  const failed = useMemo(() => failedItems(log, nccList), [log, nccList])

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4'>
          <h1 className='text-2xl font-bold tracking-tight'>Đặt hàng</h1>
          <p className='text-muted-foreground'>Duyệt đơn Base → gộp theo NCC → gửi nhóm Zalo</p>
        </div>

        {isError && data ? (
          <div className='mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            Mất kết nối máy chủ — đang hiển thị dữ liệu lúc{' '}
            {new Date(dataUpdatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            .
          </div>
        ) : null}

        {isLoading && !data ? (
          <p className='text-sm text-muted-foreground'>Đang tải…</p>
        ) : (
          <Tabs defaultValue='cho_duyet'>
            <TabsList>
              <TabsTrigger value='cho_duyet' className='gap-1.5'>
                Chờ duyệt
                <Badge variant='secondary' className='px-1.5'>
                  {pendingCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value='sent' className='gap-1.5'>
                Đã gửi
                <Badge variant='secondary' className='px-1.5'>
                  {sent.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value='failed' className='gap-1.5'>
                Lỗi
                <Badge variant={failed.length ? 'destructive' : 'secondary'} className='px-1.5'>
                  {failed.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value='cho_duyet'>
              <PendingPanel pending={pending} nccList={nccList} groups={groups} me={me} cfg={cfg} />
            </TabsContent>
            <TabsContent value='sent'>
              <SentPanel items={sent} />
            </TabsContent>
            <TabsContent value='failed'>
              <FailedPanel items={failed} />
            </TabsContent>
          </Tabs>
        )}
      </Main>
    </>
  )
}
