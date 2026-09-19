// NCC Hub v3 — POST /api/users: upsert whitelist app_user (super_admin ONLY).
// Port từ phần "+ Thêm / cập nhật người dùng" trong secUsers()/saveUser() của
// admin/public/js/views/settings.js.
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { nccApi } from '@/lib/ncc-api'
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
import { getErrMsg } from '../lib/helpers'
import { StaffPicker } from './staff-picker'

// KHÔNG dùng .default(): zod v4 làm field optional ở input type, lệch với z.infer dùng cho
// useForm — default đã set qua defaultValues bên dưới.
const userSchema = z.object({
  email: z.string().min(1, 'Nhập email OS').email('Email không hợp lệ'),
  display_name: z.string(),
  app_role: z.enum(['dept_staff', 'dept_manager', 'super_admin']),
  dept_id: z.string().min(1, 'Chọn phòng ban'),
})
type UserFormValues = z.infer<typeof userSchema>

const FALLBACK_DEPT = { dept_id: 'SCM', name: 'Mua hàng (SCM)', color: '' }

export function UserForm() {
  const { data } = useNccState()
  const qc = useQueryClient()
  const depts = data?.deptList?.length ? data.deptList : [FALLBACK_DEPT]
  const defaultValues: UserFormValues = {
    email: '',
    display_name: '',
    app_role: 'dept_staff',
    dept_id: depts[0]?.dept_id ?? 'SCM',
  }

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues,
  })

  const saveUser = useMutation({
    mutationFn: (values: UserFormValues) => nccApi.post('/users', values),
    onSuccess: () => {
      toast.success('Đã cập nhật người dùng')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
      form.reset(defaultValues)
    },
    onError: (e) => toast.error(getErrMsg(e, 'Lỗi (cần super_admin)')),
  })

  return (
    <div className='bg-muted/40 space-y-4 rounded-lg border p-4'>
      <div>
        <h4 className='text-sm font-medium'>+ Thêm / cập nhật người dùng</h4>
        <p className='text-muted-foreground text-xs'>
          Nhân viên (không phải quản lý) <b>phải có ở đây mới vào được</b>. BOD / Director /
          Manager tự vào theo chức vụ OS — không cần thêm.
        </p>
      </div>

      <StaffPicker
        onPick={(email, name) => {
          form.setValue('email', email, { shouldValidate: true })
          if (!form.getValues('display_name')) form.setValue('display_name', name)
        }}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveUser.mutate(v))} className='space-y-3'>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email OS</FormLabel>
                <FormControl>
                  <Input placeholder='email@vinhhua.com' {...field} />
                </FormControl>
                <FormDescription>
                  Whitelist khớp theo email đăng nhập OS. Thường trùng email trong Base, nhưng
                  không phải lúc nào cũng vậy — nếu người đó đăng nhập OS bằng email khác thì
                  sửa lại ô này.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='display_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên hiển thị (tuỳ chọn)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid gap-3 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='app_role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quyền</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='dept_staff'>Nhân viên — chỉ xem + đề xuất</SelectItem>
                      <SelectItem value='dept_manager'>Quản lý — duyệt &amp; gửi đơn</SelectItem>
                      <SelectItem value='super_admin'>Toàn quyền — như BOD</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='dept_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phòng ban</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {depts.map((d) => (
                        <SelectItem key={d.dept_id} value={d.dept_id}>
                          {d.name || d.dept_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type='submit' disabled={saveUser.isPending}>
            Lưu người dùng
          </Button>
        </form>
      </Form>
    </div>
  )
}
