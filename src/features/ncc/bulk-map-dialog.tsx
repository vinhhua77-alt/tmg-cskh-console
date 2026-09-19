// NCC Hub v3 — dialog "Gán nhóm hàng loạt", port bulkMapView/drawMapMatrix/mapRun từ
// admin/public/js/views/ncc.js. Nguồn danh sách = useNccState().newGroups (nhóm bot thấy
// nhưng CHƯA gán NCC nào — đã lọc dept ở backend).
//
// Deferred có chủ đích (ghi trong report cuối task): bỏ heuristic gợi ý tên khớp
// (suggestNcc/sharedScore) của bản cũ — người dùng tự chọn NCC đích qua <Select> (type-ahead
// có sẵn của Radix). Khi tạo mới, KHÔNG tự sinh mã 'TMP'+Date.now() ở client như bản cũ —
// để trống ma_ncc và để server tự sinh/tái dùng mã đã có cho đúng zalo_group_id (đúng cơ chế
// vừa fix trong routes/ncc.js, xem comment ở đó) — tránh chép lại logic sinh mã ở 2 nơi.
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useNccState } from '@/hooks/use-ncc-state'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { CREATE_NEW, type Group, type Vendor, nccName, toNccBody } from './data'
import { useSaveNccMutation, useSyncGroupsMutation } from './mutations'

export function BulkMapDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data } = useNccState()
  const isSuper = useNccAuthStore((s) => s.user?.isSuper ?? false)
  const saveMutation = useSaveNccMutation()
  const syncMutation = useSyncGroupsMutation()

  const groups = (data?.newGroups ?? []) as Group[]
  const vendors = (data?.ncc ?? []) as Vendor[]

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(new Set(groups.map((g) => g.group_id)))
      setTargets({})
    }
    // chỉ reset khi dialog MỞ lại, không theo dõi thay đổi `groups` liên tục (poll 8s)
    // để không xoá lựa chọn đang gõ giữa lúc người dùng làm việc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function targetFor(gid: string) {
    return targets[gid] ?? CREATE_NEW
  }

  function toggleAll(check: boolean) {
    setSelected(check ? new Set(groups.map((g) => g.group_id)) : new Set())
  }

  async function run() {
    const list = groups.filter((g) => selected.has(g.group_id))
    if (!list.length) {
      toast.error('Chưa chọn nhóm nào')
      return
    }
    setRunning(true)
    let created = 0
    let linked = 0
    let fail = 0
    for (const g of list) {
      const target = targetFor(g.group_id)
      try {
        if (target === CREATE_NEW) {
          await saveMutation.mutateAsync({
            ten_ncc: g.name || g.group_id,
            zalo_group_id: g.group_id,
            kenh_default: 'zalo',
            active: 0,
          })
          created++
        } else {
          const n = vendors.find((v) => v.ma_ncc === target)
          if (n) {
            await saveMutation.mutateAsync(toNccBody(n, { zalo_group_id: g.group_id }))
            linked++
          }
        }
      } catch {
        fail++
      }
    }
    setRunning(false)
    toast.success(
      `Đã tạo ${created} NCC mới · gán ${linked} NCC sẵn → nhóm${fail ? ` · lỗi ${fail}` : ''}`
    )
    onOpenChange(false)
  }

  function handleSync() {
    if (!window.confirm('Đồng bộ danh sách nhóm từ gateway Zalo?')) return
    syncMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Gán nhóm hàng loạt</DialogTitle>
          <DialogDescription>
            Mỗi nhóm Zalo = 1 NCC. Mặc định <b>Tạo NCC mới</b> (tên = tên nhóm), hoặc gán vào
            NCC có sẵn.
          </DialogDescription>
        </DialogHeader>

        {isSuper && (
          <Button
            size='sm'
            variant='outline'
            className='self-start'
            disabled={syncMutation.isPending}
            onClick={handleSync}
          >
            <RefreshCw className='size-4' />
            {syncMutation.isPending ? 'Đang đồng bộ…' : 'Đồng bộ nhóm'}
          </Button>
        )}

        {!groups.length ? (
          <p className='text-sm text-muted-foreground'>Mọi nhóm đã được gán NCC.</p>
        ) : (
          <>
            <div className='flex items-center gap-3 text-sm'>
              <span className='text-muted-foreground'>{groups.length} nhóm chưa gán</span>
              <Button variant='link' size='sm' className='h-auto p-0' onClick={() => toggleAll(true)}>
                Chọn tất cả
              </Button>
              <Button variant='link' size='sm' className='h-auto p-0' onClick={() => toggleAll(false)}>
                Bỏ chọn
              </Button>
            </div>
            <div className='max-h-96 overflow-y-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10' />
                    <TableHead>Nhóm Zalo (chưa gán)</TableHead>
                    <TableHead>Gán vào NCC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <TableRow key={g.group_id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(g.group_id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (v) next.add(g.group_id)
                              else next.delete(g.group_id)
                              return next
                            })
                          }
                          aria-label='Chọn nhóm'
                        />
                      </TableCell>
                      <TableCell className='font-medium'>{g.name || g.group_id}</TableCell>
                      <TableCell>
                        <Select
                          value={targetFor(g.group_id)}
                          onValueChange={(v) =>
                            setTargets((prev) => ({ ...prev, [g.group_id]: v }))
                          }
                        >
                          <SelectTrigger size='sm' className='w-56'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CREATE_NEW}>
                              + Tạo NCC mới (= tên nhóm)
                            </SelectItem>
                            {vendors.map((n) => (
                              <SelectItem key={n.ma_ncc} value={n.ma_ncc}>
                                {nccName(n)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={run} disabled={running || !groups.length}>
            {running ? 'Đang xử lý…' : `Tạo & gán đã chọn (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
