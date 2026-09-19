import { goToOsLogin, useNccAuthStore } from '@/lib/ncc-auth'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const reset = useNccAuthStore((s) => s.reset)

  const handleSignOut = () => {
    // Không có session cục bộ để "đăng xuất" — chỉ xoá token đã lưu, rồi trả về OS login
    // (session thật nằm ở os-core). Giữ đúng mô hình auth cũ, không tự nghĩ flow mới.
    reset()
    goToOsLogin()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Sign out'
      desc='Are you sure you want to sign out? You will need to sign in again to access your account.'
      confirmText='Sign out'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
