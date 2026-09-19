// NCC Hub v3 — auth thật, port 1:1 hành vi từ admin/public/js/app.js (osGate/goLogin cũ).
// KHÔNG tự nghĩ flow mới — đây là hệ thống critical (auth), giữ đúng semantics đã chạy production:
// cookie tmg_token same-origin ưu tiên, Bearer header (localStorage) fallback cho handoff cross-subdomain,
// 401 → redirect OS login (có bounce-loop guard), 403 → "chưa được cấp quyền" (không loop).
import { create } from 'zustand'

export interface NccUser {
  email: string
  name: string
  role: string
  app_role: string
  dept_id: string
  isSuper: boolean
}

export type NccAuthStatus = 'loading' | 'ok' | 'denied' | 'error'

interface NccAuthState {
  user: NccUser | null
  status: NccAuthStatus
  message: string
  setUser: (u: NccUser) => void
  setStatus: (s: NccAuthStatus, message?: string) => void
  reset: () => void
}

export const useNccAuthStore = create<NccAuthState>((set) => ({
  user: null,
  status: 'loading',
  message: '',
  setUser: (user) => set({ user }),
  setStatus: (status, message = '') => set({ status, message }),
  reset: () => {
    try {
      localStorage.removeItem('tmg_token')
      localStorage.removeItem('ncc_token')
    } catch {
      /* ignore */
    }
    set({ user: null, status: 'loading', message: '' })
  },
}))

const TOKEN_KEYS = ['tmg_token', 'ncc_token']

export function nccToken(): string {
  try {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k)
      if (v) return v
    }
  } catch {
    /* ignore */
  }
  return ''
}

export function nccAuthHeaders(): Record<string, string> {
  const t = nccToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// Nhận ?_t=TOKEN từ redirect OS login (handoff cross-subdomain) — giữ đúng app.js cũ.
function captureHandoffToken() {
  try {
    const t = new URLSearchParams(location.search).get('_t')
    if (t) {
      localStorage.setItem('tmg_token', t)
      history.replaceState({}, '', location.pathname + (location.hash || ''))
    }
  } catch {
    /* ignore */
  }
}

const BOUNCE_KEY = 'ncc_login_bounce'

export function goToOsLogin() {
  const now = Date.now()
  let b: number[] = []
  try {
    b = JSON.parse(sessionStorage.getItem(BOUNCE_KEY) || '[]')
  } catch {
    /* ignore */
  }
  b = b.filter((t) => now - t < 20000)
  b.push(now)
  sessionStorage.setItem(BOUNCE_KEY, JSON.stringify(b))
  if (b.length > 2) {
    sessionStorage.removeItem(BOUNCE_KEY)
    useNccAuthStore
      .getState()
      .setStatus(
        'error',
        'Đăng nhập OS xong vẫn quay lại đây (vòng lặp). Có thể trình duyệt chặn cookie. Thử: mở lại tab, hoặc bật cookie cho vinhhua.com.'
      )
    return
  }
  location.href =
    'https://os.vinhhua.com/login.html?next=' + encodeURIComponent(location.href)
}

// Chạy 1 lần lúc boot app, TRƯỚC khi render bất kỳ route bảo vệ nào.
export async function runOsGate(): Promise<void> {
  captureHandoffToken()
  const store = useNccAuthStore.getState()

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    store.setStatus('ok')
    return
  }

  let r: Response
  try {
    r = await fetch('/api/me', {
      credentials: 'same-origin',
      headers: nccAuthHeaders(),
    })
  } catch {
    store.setStatus(
      'error',
      'Không thể kết nối máy chủ. Tải lại trang để thử lại.'
    )
    return
  }

  if (r.status === 200) {
    sessionStorage.removeItem(BOUNCE_KEY)
    const j = await r.json().catch(() => ({}))
    store.setUser({
      email: j.email || '',
      name: j.name || '',
      role: j.role || '',
      app_role: j.app_role || '',
      dept_id: j.dept_id || '',
      isSuper: !!j.isSuper,
    })
    store.setStatus('ok')
    return
  }

  if (r.status === 403) {
    const j = await r.json().catch(() => ({}))
    store.setStatus(
      'denied',
      j.error || 'Tài khoản chưa được cấp quyền NCC Hub. Liên hệ SCM/IT để thêm.'
    )
    return
  }

  // 401 → token hết hạn/không có → về OS login.
  goToOsLogin()
}
