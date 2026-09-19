// NCC Hub v3 — section "Người dùng": whitelist app_user (super_admin ONLY).
// Port từ secUsers()/removeUser() + soi trạng thái nhân sự (spDecorateUsers) trong
// admin/public/js/views/settings.js.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { nccApi } from '@/lib/ncc-api'
import { useNccAuthStore } from '@/lib/ncc-auth'
import { useNccState } from '@/hooks/use-ncc-state'
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
import { useStaffStatus } from '../hooks/use-staff'
import { getErrMsg } from '../lib/helpers'
import type { NccAppUser } from '../types'
import { DeptForm } from './dept-form'
import { UserForm } from './user-form'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Toàn quyền (BOD)',
  dept_manager: 'Quản lý',
  dept_staff: 'Nhân viên',
}

export function SettingsUsers() {
  const isSuper = useNccAuthStore((s) => s.user?.isSuper) ?? false
  const meEmail = useNccAuthStore((s) => s.user?.email)
  const { data } = useNccState()
  const qc = useQueryClient()

  const users = ((data?.users as NccAppUser[] | undefined) ?? []).filter((u) => u.active)
  const emails = users.map((u) => u.email)
  const { data: statusData } = useStaffStatus(isSuper ? emails : [])
  const deptName = (id: string) => data?.deptList?.find((d) => d.dept_id === id)?.name || id

  const removeUser = useMutation({
    mutationFn: (email: string) => nccApi.post('/users/remove', { email }),
    onSuccess: () => {
      toast.success('Đã gỡ quyền')
      qc.invalidateQueries({ queryKey: ['ncc-state'] })
    },
    onError: (e) => toast.error(getErrMsg(e, 'Lỗi')),
  })

  if (!isSuper) {
    return (
      <ContentSection title='Người dùng' desc='Whitelist ai được vào + phân quyền'>
        <p className='text-muted-foreground text-sm'>
          Chỉ super_admin xem &amp; quản lý người dùng.
        </p>
      </ContentSection>
    )
  }

  return (
    <ContentSection title='Người dùng' desc='Whitelist ai được vào + phân quyền'>
      <div className='space-y-6'>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Quyền</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Nhân sự Base</TableHead>
                <TableHead className='text-right'>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground text-center'>
                    Chưa có ai trong whitelist. BOD/Quản lý vẫn tự vào theo chức vụ OS.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const st = statusData?.status?.[u.email]
                  return (
                    <TableRow key={u.email}>
                      <TableCell>
                        <div className='font-medium'>{u.display_name || u.email.split('@')[0]}</div>
                        <div className='text-muted-foreground text-xs'>{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.app_role === 'super_admin' ? 'default' : 'secondary'}>
                          {ROLE_LABEL[u.app_role] ?? u.app_role}
                        </Badge>
                      </TableCell>
                      <TableCell>{deptName(u.dept_id)}</TableCell>
                      <TableCell>
                        {!st ? (
                          <Badge variant='outline'>…</Badge>
                        ) : !st.found ? (
                          <Badge variant='outline' title='Email này không có trong Base HRM — có thể dùng email công ty, hoặc không phải nhân sự'>
                            không có trong Base
                          </Badge>
                        ) : st.terminated ? (
                          <Badge
                            variant='destructive'
                            title={`${st.name} (${st.code}) — Base ghi đã nghỉ. Cân nhắc gỡ quyền.`}
                          >
                            ĐÃ NGHỈ {st.terminated_date}
                          </Badge>
                        ) : (
                          <Badge className='bg-chart-3 text-white' title={`${st.name} · ${st.office_name}`}>
                            đang làm
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        {u.email === meEmail ? (
                          <span className='text-muted-foreground text-xs'>bạn</span>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size='sm' variant='destructive'>
                                Gỡ
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Gỡ quyền vào NCC Hub?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.email} sẽ không còn vào được NCC Hub.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Huỷ</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeUser.mutate(u.email)}>
                                  Gỡ quyền
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <UserForm />
        <DeptForm />
      </div>
    </ContentSection>
  )
}
