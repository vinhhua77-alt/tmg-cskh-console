// NCC Hub v3 — section "Hệ thống": cấu hình kéo đơn Base.vn + poll thủ công + áp bộ lọc.
// super_admin ONLY (client-gate ở đây; backend chặn 403 ở /api/config, cho phép ở
// /api/pending/apply-filter và /api/base/poll — /api/base/poll cũng chặn 403 phía server).
// Port từ secSys()/saveBase()/applyFilterNow()/pollBase() trong admin/public/js/views/settings.js.
import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { nccApi } from '@/lib/ncc-api'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { useNccState } from '@/hooks/use-ncc-state'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ContentSection } from '@/features/settings/components/content-section'
import { useSetConfig } from '../hooks/use-set-config'
import { fmtDateTime, fmtNum, getErrMsg } from '../lib/helpers'

// KHÔNG dùng .default() ở đây: zod v4 làm field đó optional ở input type, lệch với type
// z.infer dùng cho useForm<SystemFormValues> (RHF cần input/output type khớp nhau khi có
// defaultValues tường minh, nên set default qua defaultValues bên dưới, không qua schema).
const systemSchema = z.object({
  base_service_id: z.string(),
  base_stage: z.string(),
  base_poll_mode: z.enum(['bridge', 'api']),
  base_poll_min: z.string().regex(/^\d*$/, 'Chỉ nhập số'),
  base_cutoff_hour: z.string().regex(/^\d*$/, 'Chỉ nhập số'),
  base_enabled: z.boolean(),
  base_skip_stale: z.boolean(),
  base_only_mapped: z.boolean(),
  read_enabled: z.boolean(),
})
type SystemFormValues = z.infer<typeof systemSchema>

function cfgToFormValues(cfg: Record<string, string>): SystemFormValues {
  return {
    base_service_id: cfg.base_service_id ?? '',
    base_stage: cfg.base_stage ?? '',
    base_poll_mode: cfg.base_poll_mode === 'api' ? 'api' : 'bridge',
    base_poll_min: cfg.base_poll_min ?? '15',
    base_cutoff_hour: cfg.base_cutoff_hour ?? '16',
    base_enabled: cfg.base_enabled === '1',
    base_skip_stale: cfg.base_skip_stale === '1',
    base_only_mapped: cfg.base_only_mapped === '1',
    read_enabled: cfg.read_enabled === '1',
  }
}

export function SettingsSystem() {
  const isSuper = useNccAuthStore((s) => s.user?.isSuper) ?? false
  const { data } = useNccState()
  const qc = useQueryClient()
  const setConfig = useSetConfig()
  const [pollOutput, setPollOutput] = useState<string | null>(null)

  const cfg = data?.cfg ?? {}
  const form = useForm<SystemFormValues>({
    resolver: zodResolver(systemSchema),
    defaultValues: cfgToFormValues(cfg),
  })

  // Nạp giá trị từ server đúng 1 lần khi data về — KHÔNG reset lại mỗi lần poll 8s,
  // để không xoá mất chỗ người dùng đang sửa (giống hành vi bản cũ: redrawSec chỉ chạy
  // sau hành động, không chạy theo poll nền).
  const initialized = useRef(false)
  useEffect(() => {
    if (!data?.cfg || initialized.current) return
    form.reset(cfgToFormValues(data.cfg))
    initialized.current = true
  }, [data?.cfg, form])

  const applyFilter = useMutation({
    mutationFn: () => nccApi.post('/pending/apply-filter', {}),
    onSuccess: (res) => {
      const removed = res.data?.removed ?? 0
      toast.success(removed ? `Đã ẩn ${removed} đơn không khớp` : res.data?.note || 'Không có đơn nào bị ẩn')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
    },
    onError: (e) => toast.error(getErrMsg(e, 'Áp lọc lỗi')),
  })

  const pollBase = useMutation({
    mutationFn: () => nccApi.post('/base/poll', {}),
    onSuccess: (res) => {
      toast.success(res.data?.ok ? 'Đã kéo đơn từ Base' : res.data?.error || 'Kéo lỗi')
      setPollOutput(res.data?.output || res.data?.error || 'xong')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
    },
    onError: (e) => toast.error(getErrMsg(e, 'Kéo lỗi')),
  })

  if (!isSuper) {
    return (
      <ContentSection title='Hệ thống' desc='Kết nối Base · chu kỳ kéo đơn'>
        <p className='text-muted-foreground text-sm'>
          Chỉ super_admin xem &amp; sửa cấu hình hệ thống.
        </p>
      </ContentSection>
    )
  }

  function onSubmit(values: SystemFormValues) {
    setConfig.mutate(
      {
        base_service_id: values.base_service_id.trim(),
        base_stage: values.base_stage.trim(),
        base_poll_mode: values.base_poll_mode,
        base_poll_min: values.base_poll_min.trim() || '15',
        base_cutoff_hour: values.base_cutoff_hour.trim() || '16',
        base_enabled: values.base_enabled ? '1' : '0',
        base_skip_stale: values.base_skip_stale ? '1' : '0',
        base_only_mapped: values.base_only_mapped ? '1' : '0',
        read_enabled: values.read_enabled ? '1' : '0',
      },
      { onSuccess: () => toast.success('Đã lưu cấu hình Base') }
    )
  }

  return (
    <ContentSection title='Hệ thống' desc='Kết nối Base · chu kỳ kéo đơn'>
      <div className='space-y-6'>
        <p className='text-muted-foreground text-sm'>
          Tự kéo đơn từ quy trình Base <b>C01 — Mua hàng/Đặt hàng NVL</b> về mục &quot;chờ
          duyệt&quot;. KHÔNG tự gửi — người duyệt thủ công.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='base_enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-md border p-3'>
                  <FormLabel className='mb-0'>Bật tự động kéo đơn</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='base_service_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã quy trình (service_id)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='base_stage'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bước (stage) lấy đơn</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='base_poll_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nguồn dữ liệu</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='bridge'>Bridge — file inbox.json (ổn định)</SelectItem>
                      <SelectItem value='api'>Base API trực tiếp (cần wire)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='base_poll_min'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chu kỳ kéo (phút)</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='base_cutoff_hour'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gom đơn — giờ chốt nhắc duyệt hằng ngày</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} max={23} {...field} />
                    </FormControl>
                    <FormDescription>
                      Đơn dồn cả ngày; đến giờ này trang chủ nhắc &quot;Duyệt &amp; gửi tất
                      cả&quot; 1 lần. KHÔNG tự gửi.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <h4 className='mb-2 text-sm font-medium'>Bộ lọc kéo đơn</h4>
              <div className='space-y-2'>
                <FormField
                  control={form.control}
                  name='base_skip_stale'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-md border p-3'>
                      <div>
                        <FormLabel className='mb-0'>Chỉ kéo đơn MỚI</FormLabel>
                        <p className='text-muted-foreground text-xs'>Bỏ đơn đã qua ngày giao</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='base_only_mapped'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-md border p-3'>
                      <div>
                        <FormLabel className='mb-0'>Chỉ kéo NCC đã gán nhóm</FormLabel>
                        <p className='text-muted-foreground text-xs'>Bật khi đã map xong</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='read_enabled'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between rounded-md border p-3'>
                      <div>
                        <FormLabel className='mb-0'>Bot đọc phản hồi NCC</FormLabel>
                        <p className='text-muted-foreground text-xs'>
                          Chỉ đọc + báo cáo, KHÔNG tự trả lời (D-003)
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button type='submit' disabled={setConfig.isPending}>
                Lưu cấu hình
              </Button>
              <Button
                type='button'
                variant='outline'
                disabled={applyFilter.isPending}
                onClick={() => applyFilter.mutate()}
              >
                Áp bộ lọc đơn đang chờ
              </Button>
            </div>
          </form>
        </Form>

        <div>
          <h4 className='mb-3 text-sm font-medium'>Trạng thái kéo đơn</h4>
          <div className='space-y-2 text-sm'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Lần kéo gần nhất</span>
              <span className='font-medium'>
                {cfg.base_last_poll ? fmtDateTime(cfg.base_last_poll) : 'chưa kéo'}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Số đơn kéo lần cuối</span>
              <span className='font-medium'>{fmtNum(Number(cfg.base_last_count) || 0)}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Đang chờ duyệt</span>
              <span className='font-medium'>{fmtNum(data?.pending.length ?? 0)}</span>
            </div>
          </div>
          <Button
            className='mt-3'
            variant='outline'
            size='sm'
            disabled={pollBase.isPending}
            onClick={() => pollBase.mutate()}
          >
            {pollBase.isPending ? 'Đang kéo…' : 'Kéo đơn ngay'}
          </Button>
          {pollOutput && (
            <pre className='mt-3 max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap'>
              {pollOutput}
            </pre>
          )}
        </div>
      </div>
    </ContentSection>
  )
}
