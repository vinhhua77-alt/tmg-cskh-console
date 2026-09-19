// NCC Hub v3 — CRUD mẫu tin: POST /api/templates (mới) · PATCH /api/templates/:id (sửa).
// Port từ tplForm()/saveTpl() trong admin/public/js/views/settings.js.
import { useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { nccApi } from '@/lib/ncc-api'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { useNccState } from '@/hooks/use-ncc-state'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
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
import { Textarea } from '@/components/ui/textarea'
import { getErrMsg } from '../lib/helpers'
import type { NccTemplate } from '../types'
import { TPL_KIND, TPL_VARS, renderPreview } from './constants'

// KHÔNG dùng .default(): zod v4 làm field optional ở input type, lệch với z.infer dùng cho
// useForm — default đã set qua defaultValues khi khởi tạo form (theo template/isNew).
const templateSchema = z.object({
  loai: z.enum(['don_dat_hang', 'nhac_giao', 'thong_bao']),
  tieu_de: z.string().max(200),
  noi_dung: z.string().min(1, 'Nhập nội dung mẫu'),
  active: z.boolean(),
  shared: z.boolean(),
  dept_id: z.string(),
})
type TemplateFormValues = z.infer<typeof templateSchema>

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: NccTemplate | null
}

export function TemplateFormDialog({ open, onOpenChange, template }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        {/* key theo template → remount form với defaultValues đúng mỗi lần mở, không cần useEffect reset */}
        {open && (
          <TemplateForm
            key={template?.id ?? 'new'}
            template={template}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TemplateForm({
  template,
  onDone,
}: {
  template: NccTemplate | null
  onDone: () => void
}) {
  const { data } = useNccState()
  const isSuper = useNccAuthStore((s) => s.user?.isSuper) ?? false
  const qc = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const isNew = !template

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      loai: (template?.loai as TemplateFormValues['loai']) ?? 'thong_bao',
      tieu_de: template?.tieu_de ?? '',
      noi_dung: template?.noi_dung ?? '',
      active: template ? !!template.active : true,
      shared: !!template?.shared,
      dept_id: template?.dept_id ?? '',
    },
  })

  const createTpl = useMutation({
    mutationFn: (body: Record<string, unknown>) => nccApi.post('/templates', body),
    onSuccess: () => {
      toast.success('Đã lưu mẫu tin')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
      onDone()
    },
    onError: (e) => toast.error(getErrMsg(e, 'Lưu mẫu lỗi')),
  })
  const updateTpl = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      nccApi.patch(`/templates/${template?.id}`, body),
    onSuccess: () => {
      toast.success('Đã lưu mẫu tin')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
      onDone()
    },
    onError: (e) => toast.error(getErrMsg(e, 'Lưu mẫu lỗi')),
  })
  const pending = createTpl.isPending || updateTpl.isPending

  function onSubmit(values: TemplateFormValues) {
    if (isNew) {
      createTpl.mutate({
        loai: values.loai,
        kenh: 'zalo',
        tieu_de: values.tieu_de.trim(),
        noi_dung: values.noi_dung.trim(),
        // dept_id/shared: chỉ super_admin chỉ định được (server bỏ qua nếu người thường gửi lên).
        ...(isSuper && values.shared ? { shared: 1 } : {}),
        ...(isSuper && values.dept_id ? { dept_id: values.dept_id } : {}),
      })
    } else {
      // PATCH /api/templates/:id chỉ nhận tieu_de/noi_dung/active — không đổi được dept_id/shared.
      updateTpl.mutate({
        tieu_de: values.tieu_de.trim(),
        noi_dung: values.noi_dung.trim(),
        active: values.active ? 1 : 0,
      })
    }
  }

  function insertVar(tok: string) {
    const el = textareaRef.current
    const current = form.getValues('noi_dung') || ''
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? start
    const next = current.slice(0, start) + tok + current.slice(end)
    form.setValue('noi_dung', next, { shouldValidate: true, shouldDirty: true })
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + tok.length
      el?.setSelectionRange(pos, pos)
    })
  }

  // useWatch (không phải form.watch()) — an toàn với React Compiler, không bị bỏ memo hoá.
  const noiDung = useWatch({ control: form.control, name: 'noi_dung' })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? 'Thêm' : 'Sửa'} mẫu tin</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          <FormField
            control={form.control}
            name='loai'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loại</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!isNew}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TPL_KIND).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='tieu_de'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên mẫu</FormLabel>
                <FormControl>
                  <Input placeholder='VD: Đặt hàng rau củ' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='noi_dung'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nội dung</FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder='Kính gửi {ten_ncc}, ...'
                    {...field}
                    ref={(el) => {
                      field.ref(el)
                      textareaRef.current = el
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex flex-wrap gap-1.5'>
            <span className='text-muted-foreground self-center text-xs'>Chèn biến:</span>
            {TPL_VARS.map((v) => (
              <Button
                key={v.tok}
                type='button'
                size='sm'
                variant='outline'
                className='h-6 px-2 text-xs'
                onClick={() => insertVar(v.tok)}
              >
                {v.tok}
              </Button>
            ))}
          </div>

          <div>
            <FormLabel className='mb-1.5 block'>Xem trước (thay biến mẫu)</FormLabel>
            <div className='rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap'>
              {renderPreview(noiDung)}
            </div>
          </div>

          {!isNew && (
            <FormField
              control={form.control}
              name='active'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-md border p-3'>
                  <FormLabel className='mb-0'>Bật mẫu này</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {isSuper && isNew && (
            <div className='grid gap-3 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='dept_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phòng ban</FormLabel>
                    <Select
                      value={field.value || '__mine__'}
                      onValueChange={(v) => field.onChange(v === '__mine__' ? '' : v)}
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='__mine__'>Phòng của bạn</SelectItem>
                        {(data?.deptList ?? []).map((d) => (
                          <SelectItem key={d.dept_id} value={d.dept_id}>
                            {d.name || d.dept_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='shared'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-md border p-3'>
                    <FormLabel className='mb-0'>Dùng chung mọi phòng ban</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button type='button' variant='outline' onClick={onDone}>
              Huỷ
            </Button>
            <Button type='submit' disabled={pending}>
              Lưu mẫu
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
