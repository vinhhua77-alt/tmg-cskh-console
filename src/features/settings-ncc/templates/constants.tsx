// NCC Hub v3 — hằng số + preview cho Mẫu tin, port từ admin/public/js/views/settings.js (TPL_KIND/TPL_VARS).
import type { ReactNode } from 'react'

export const TPL_KIND: Record<string, string> = {
  don_dat_hang: 'Đặt hàng',
  nhac_giao: 'Nhắc giao',
  thong_bao: 'Thông báo chung',
}

export const TPL_VARS: { tok: string; demo: string }[] = [
  { tok: '{ten_ncc}', demo: 'Công ty Rau Sạch An Phú' },
  { tok: '{don}', demo: 'PO-2026-0148' },
  { tok: '{ngay}', demo: new Date().toLocaleDateString('vi-VN') },
  { tok: '{ncc}', demo: 'NCC-001' },
  { tok: '{po}', demo: 'PO-2026-0148' },
  { tok: '{giao}', demo: '07:00 mai' },
]

const VAR_PATTERN = new RegExp(
  `(${TPL_VARS.map((v) => v.tok.replace(/[{}]/g, (m) => '\\' + m)).join('|')})`,
  'g'
)

/**
 * Thay token biến bằng giá trị mẫu để xem trước. Tách chuỗi bằng regex và render từng
 * đoạn thành node React riêng (KHÔNG dùng dangerouslySetInnerHTML) — nội dung người dùng
 * gõ không bao giờ được diễn giải thành HTML/script.
 */
export function renderPreview(text: string): ReactNode {
  if (!text) {
    return <span className='text-muted-foreground'>Gõ nội dung để xem trước…</span>
  }
  return text.split(VAR_PATTERN).map((part, i) => {
    const v = TPL_VARS.find((x) => x.tok === part)
    return v ? (
      <mark key={i} className='rounded bg-primary/15 px-1 font-medium text-primary'>
        {v.demo}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  })
}
