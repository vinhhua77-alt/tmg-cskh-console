// NCC Hub v3 — dialog Thêm/Sửa NCC, port editNcc/saveNcc từ admin/public/js/views/ncc.js.
//
// Cố ý khác bản cũ: mã NCC (`ma_ncc`) LUÔN readonly khi sửa (bản cũ chỉ readonly khi mã đã
// "thật" — không bắt đầu bằng TMP — còn NCC còn mã tạm TMP thì field hiện EDITABLE nhưng
// saveNcc() lại luôn gửi `orig` (mã gốc) bất kể người dùng gõ gì, nên input đó là "chết" —
// một bug im lặng trong bản cũ). POST /api/ncc upsert theo ma_ncc: nếu route THẬT cho phép
// đổi mã ở đây, gửi 1 mã khác sẽ tạo THÊM 1 dòng ncc mới trùng zalo_group_id với dòng cũ
// (đúng lớp lỗi 41-nhóm-trùng-mã đã ghi trong CLAUDE.md D-020/D-021) — nên bản mới chặn
// hẳn việc đổi mã qua UI, safety hơn transplant nguyên văn hành vi cũ.
import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNccState } from '@/hooks/use-ncc-state'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea'
import { NCC_STATES, UNSET, type Vendor, stateOf } from './data'
import { useNccStatusMutation, useSaveNccMutation } from './mutations'

const formSchema = z.object({
  ten_ncc: z.string().min(1, 'Nhập tên NCC'),
  ma_ncc: z.string().optional(),
  zalo_group_id: z.string(),
  email: z.string().optional(),
  sdt: z.string().optional(),
  kenh_default: z.enum(['zalo', 'email', 'both']),
  nhom_hang: z.string().optional(),
  ghi_chu: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(['cho_duyet', 'dang_dung', 'tam_dung', 'ngung']),
})

type FormValues = z.infer<typeof formSchema>

function defaultsFor(vendor: Vendor | null): FormValues {
  if (!vendor) {
    return {
      ten_ncc: '',
      ma_ncc: '',
      zalo_group_id: UNSET,
      email: '',
      sdt: '',
      kenh_default: 'zalo',
      nhom_hang: '',
      ghi_chu: '',
      tags: '',
      status: 'cho_duyet',
    }
  }
  return {
    ten_ncc: vendor.ten_ncc || '',
    ma_ncc: vendor.ma_ncc || '',
    zalo_group_id: vendor.zalo_group_id || UNSET,
    email: vendor.email || '',
    sdt: vendor.sdt || '',
    kenh_default: vendor.kenh_default || 'zalo',
    nhom_hang: vendor.nhom_hang || '',
    ghi_chu: vendor.ghi_chu || '',
    tags: (vendor.tags || []).join(', '),
    status: stateOf(vendor),
  }
}

export function NccEditDialog({
  open,
  onOpenChange,
  vendor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor: Vendor | null
}) {
  const { data } = useNccState()
  const groups = data?.groups ?? []
  const saveMutation = useSaveNccMutation()
  const statusMutation = useNccStatusMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(vendor),
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(vendor))
  }, [open, vendor, form])

  function onSubmit(values: FormValues) {
    const tags = values.tags
      ? values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []
    const body = {
      ma_ncc: vendor ? vendor.ma_ncc : values.ma_ncc?.trim() || undefined,
      ten_ncc: values.ten_ncc.trim(),
      zalo_group_id: values.zalo_group_id === UNSET ? '' : values.zalo_group_id,
      email: values.email?.trim() || '',
      sdt: values.sdt?.trim() || '',
      kenh_default: values.kenh_default,
      nhom_hang: values.nhom_hang?.trim() || '',
      ghi_chu: values.ghi_chu?.trim() || '',
      tags,
      active: values.status === 'dang_dung' ? 1 : 0,
    }
    const currentStatus = vendor ? stateOf(vendor) : 'cho_duyet'

    saveMutation.mutate(body, {
      onSuccess: (res) => {
        toast.success('Đã lưu NCC')
        const savedMa = vendor?.ma_ncc || res.ma_ncc || body.ma_ncc
        if (savedMa && values.status !== currentStatus) {
          if (
            values.status === 'dang_dung' &&
            !window.confirm(
              `Đặt "${body.ten_ncc}" sang ĐANG DÙNG?\nNCC sẽ nhận tin khi ở chế độ GỬI THẬT.`
            )
          ) {
            onOpenChange(false)
            return
          }
          statusMutation.mutate({ ma: savedMa, status: values.status })
        }
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{vendor ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</DialogTitle>
          <DialogDescription>
            NCC chỉ nhận tin khi hệ thống ở chế độ GỬI THẬT <b>và</b> vòng đời = Đang dùng.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='ten_ncc'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên nhà cung cấp *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='ma_ncc'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã NCC (Base/AMIS)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!!vendor}
                      placeholder={vendor ? undefined : 'Để trống sẽ tự sinh'}
                    />
                  </FormControl>
                  {vendor && (
                    <p className='text-xs text-muted-foreground'>
                      Mã NCC không đổi được sau khi tạo.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='zalo_group_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nhóm Zalo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={UNSET}>— chưa gán —</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.group_id} value={g.group_id}>
                          {g.name || g.group_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='sdt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số điện thoại</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='kenh_default'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kênh mặc định</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='zalo'>Zalo</SelectItem>
                        <SelectItem value='email'>Email</SelectItem>
                        <SelectItem value='both'>Cả hai</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='nhom_hang'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhãn nhóm hàng</FormLabel>
                    <FormControl>
                      <Input placeholder='rau / thịt / khô…' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='status'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vòng đời</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NCC_STATES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
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
              name='ghi_chu'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nhãn (tag, cách nhau bằng dấu phẩy)</FormLabel>
                  <FormControl>
                    <Input placeholder='vip, công nợ, ưu tiên…' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button type='submit' disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Đang lưu…' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
