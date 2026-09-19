// NCC Hub v3 — section "Mẫu tin": thư viện mẫu tin (CRUD + preview live + biến).
// Port từ secTpl() trong admin/public/js/views/settings.js.
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNccState } from '@/hooks/use-ncc-state'
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
import type { NccTemplate } from '../types'
import { TPL_KIND, TPL_VARS } from './constants'
import { TemplateFormDialog } from './template-form-dialog'

export function SettingsTemplates() {
  const { data, isLoading } = useNccState()
  const [dialog, setDialog] = useState<{ open: boolean; template: NccTemplate | null }>({
    open: false,
    template: null,
  })

  const templates = ((data?.templates as NccTemplate[] | undefined) ?? [])
    .slice()
    .sort((a, b) => `${a.loai}${a.id}`.localeCompare(`${b.loai}${b.id}`))

  return (
    <ContentSection title='Mẫu tin' desc='Thư viện mẫu tin nhắn + biến + xem trước'>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-muted-foreground text-sm'>
            Biến dùng được: {TPL_VARS.map((v) => v.tok).join(' ')}
          </p>
          <Button size='sm' onClick={() => setDialog({ open: true, template: null })}>
            <Plus className='size-4' />
            Mẫu mới
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Tên mẫu</TableHead>
                <TableHead>Nội dung</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className='text-right'>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground text-center'>
                    Đang tải…
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground text-center'>
                    Chưa có mẫu tin.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{TPL_KIND[t.loai] ?? t.loai}</TableCell>
                    <TableCell>
                      <span className='font-medium'>{t.tieu_de || '(không tên)'}</span>
                      {!!t.shared && (
                        <Badge variant='secondary' className='ms-2'>
                          chung
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className='text-muted-foreground max-w-80 truncate'
                      title={t.noi_dung}
                    >
                      {(t.noi_dung || '').replace(/\n/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.active ? 'default' : 'outline'}>
                        {t.active ? 'bật' : 'tắt'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => setDialog({ open: true, template: t })}
                      >
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TemplateFormDialog
          open={dialog.open}
          template={dialog.template}
          onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        />
      </div>
    </ContentSection>
  )
}
