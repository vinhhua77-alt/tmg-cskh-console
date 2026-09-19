// NCC Hub v3 — POST /api/dept: mở phòng ban mới (super_admin ONLY, D-011 multi-dept-ready).
// Không có UI cũ để port (settings.js vanilla chưa có màn này) — dựng theo đúng contract
// admin/routes/config.js POST /dept: {dept_id, name, color, base_service_id}.
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { nccApi } from '@/lib/ncc-api'
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
import { getErrMsg } from '../lib/helpers'

// KHÔNG dùng .default(): zod v4 làm field optional ở input type, lệch với z.infer dùng cho
// useForm — default đã set qua defaultValues bên dưới (DEFAULTS).
const deptSchema = z.object({
  dept_id: z.string().min(1, 'Nhập mã phòng ban'),
  name: z.string(),
  color: z.string(),
  base_service_id: z.string(),
})
type DeptFormValues = z.infer<typeof deptSchema>

const DEFAULTS: DeptFormValues = { dept_id: '', name: '', color: '#1F7A4D', base_service_id: '' }

export function DeptForm() {
  const qc = useQueryClient()
  const form = useForm<DeptFormValues>({ resolver: zodResolver(deptSchema), defaultValues: DEFAULTS })

  const createDept = useMutation({
    mutationFn: (values: DeptFormValues) => nccApi.post('/dept', values),
    onSuccess: () => {
      toast.success('Đã mở phòng ban mới')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
      form.reset(DEFAULTS)
    },
    onError: (e) => toast.error(getErrMsg(e, 'Lỗi (cần super_admin)')),
  })

  return (
    <div className='bg-muted/40 space-y-4 rounded-lg border p-4'>
      <div>
        <h4 className='text-sm font-medium'>+ Mở phòng ban mới</h4>
        <p className='text-muted-foreground text-xs'>
          Mỗi phòng có mẫu tin, nhóm Zalo và whitelist riêng — chỉ mở khi CEO đã chốt phòng đó
          tham gia NCC Hub.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => createDept.mutate(v))} className='space-y-3'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='dept_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã phòng ban</FormLabel>
                  <FormControl>
                    <Input placeholder='VD: KT' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên hiển thị</FormLabel>
                  <FormControl>
                    <Input placeholder='VD: Kế toán' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='color'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Màu nhãn</FormLabel>
                  <FormControl>
                    <Input type='color' className='h-9 w-16 p-1' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='base_service_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã quy trình Base (tuỳ chọn)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>Để trống nếu phòng này chưa kéo đơn từ Base.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type='submit' variant='outline' disabled={createDept.isPending}>
            Mở phòng ban
          </Button>
        </form>
      </Form>
    </div>
  )
}
