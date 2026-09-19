// NCC Hub v3 — helper dùng chung cho các section Cài đặt.
import { AxiosError } from 'axios'
import { format } from 'date-fns'

/** Rút thông điệp lỗi từ response {ok:false,error:'...'} của backend NCC Hub. */
export function getErrMsg(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const msg = error.response?.data?.error
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

/**
 * SQLite `datetime('now')` trả "YYYY-MM-DD HH:MM:SS" (UTC, KHÔNG hậu tố). Parse thẳng
 * bằng `new Date(ts)` hoặc so sánh string thô giữa nguồn này với ISO khác sẽ lệch giờ/lệch
 * kết quả — phải ép về ISO+Z trước khi dùng. (Gotcha #6 đã ghi trong
 * ZALO-INTEGRATION/CLAUDE.md: bug thật do so 2 timestamp khác định dạng bằng string.)
 */
export function parseSqliteTs(ts: string | null | undefined): Date | null {
  if (!ts) return null
  const iso = ts.includes('T') ? ts : `${ts.replace(' ', 'T')}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtTime(ts: string | null | undefined): string {
  const d = parseSqliteTs(ts)
  return d ? format(d, 'HH:mm') : '—'
}

export function fmtDateTime(ts: string | null | undefined): string {
  const d = parseSqliteTs(ts)
  return d ? format(d, 'dd/MM HH:mm') : '—'
}

export function fmtNum(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString('vi-VN')
}

export function fmtUptime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '—'
  if (s < 60) return `${Math.floor(s)}s`
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}n ${h % 24}g`
  if (h > 0) return `${h}g ${m % 60}p`
  return `${m}p`
}

export type SendMode = 'paused' | 'test' | 'live'

/** paused/test_mode đọc từ config — cùng logic isPaused()/isTest() của store.js cũ. */
export function modeOf(cfg: Record<string, string> | undefined): SendMode {
  const c = cfg ?? {}
  if (c.paused === '1') return 'paused'
  return c.test_mode === '1' ? 'test' : 'live'
}
