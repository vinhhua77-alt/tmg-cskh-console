// NCC Hub v3 — picker nhân viên Base cho whitelist app_user (thay ô gõ email tay).
// Port từ spInit()/spSearch()/spPick() trong admin/public/js/views/settings.js.
// CHỈ hiện người ĐANG LÀM VIỆC (backend đã lọc is_terminated) — người chưa có email trong
// Base hiện mờ, không chọn được, vì whitelist bắt buộc cần email.
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStaffOffices, useStaffSearch, type StaffRow } from '../hooks/use-staff'

interface StaffPickerProps {
  onPick: (email: string, name: string) => void
}

export function StaffPicker({ onPick }: StaffPickerProps) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [office, setOffice] = useState('')
  const [picked, setPicked] = useState<{ email: string; name: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 280)
    return () => clearTimeout(t)
  }, [q])

  const { data: officesData } = useStaffOffices(true)
  const { data: searchData, isFetching } = useStaffSearch(debouncedQ, office)
  const showResults = debouncedQ.trim().length >= 2 || !!office

  function pick(row: StaffRow) {
    if (!row.email) return
    setPicked({ email: row.email, name: row.name })
    onPick(row.email, row.name)
    setQ('')
  }

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap gap-2'>
        <Input
          placeholder='Tìm nhân viên — tên / mã TM… / email'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className='min-w-48 flex-1'
        />
        <Select value={office || '__all__'} onValueChange={(v) => setOffice(v === '__all__' ? '' : v)}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='Tất cả phòng ban' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='__all__'>Tất cả phòng ban</SelectItem>
            {(officesData?.offices ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name} ({o.n})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showResults && (
        <div className='max-h-56 overflow-y-auto rounded-md border'>
          {isFetching ? (
            <div className='text-muted-foreground p-3 text-sm'>Đang tìm…</div>
          ) : !searchData?.ok ? (
            <div className='text-muted-foreground p-3 text-sm'>
              {searchData?.error || 'Không tải được danh bạ'}
            </div>
          ) : searchData.staff.length === 0 ? (
            <div className='text-muted-foreground p-3 text-sm'>
              Không tìm thấy ai đang làm việc khớp với từ khoá.
            </div>
          ) : (
            <>
              {searchData.staff.map((s) => (
                <button
                  type='button'
                  key={s.code + s.email}
                  disabled={!s.email}
                  onClick={() => pick(s)}
                  className='hover:bg-accent flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm last:border-0 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <span className='font-medium'>{s.name}</span>
                  <span className='text-muted-foreground text-xs'>
                    {s.code}
                    {s.title ? ` · ${s.title}` : ''}
                    {s.office_name ? ` · ${s.office_name}` : ''}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {s.email || 'chưa có email trong Base'}
                  </span>
                </button>
              ))}
              {searchData.truncated && (
                <div className='text-muted-foreground p-2 text-center text-xs'>
                  Còn {searchData.total - 50} người nữa — gõ thêm để thu hẹp.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {picked && (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          Đã chọn <b>{picked.name}</b> · {picked.email}
          <button
            type='button'
            className='text-primary underline'
            onClick={() => setPicked(null)}
          >
            đổi người
          </button>
        </div>
      )}
    </div>
  )
}
