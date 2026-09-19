// NCC Hub v3 — hook đọc /api/state thật (admin/routes/state.js), thay S/store.js cũ (app.js vanilla).
// Poll 8s như bản cũ (setInterval(loadState, 8000)).
import { useQuery } from '@tanstack/react-query'
import { nccApi } from '@/lib/ncc-api'

export interface NccOrder {
  id: number
  ma_ncc: string
  status: string
  [key: string]: unknown
}

export interface NccVendor {
  ma_ncc: string
  ten_ncc: string
  status: string
  active: number
  dept_id: string
  tags: string[]
  [key: string]: unknown
}

export interface NccGroup {
  group_id: string
  name: string
  dept_id: string
  [key: string]: unknown
}

export interface NccMessage {
  id: number
  group_id: string
  is_self: number
  handled_by: string | null
  handled_at: string | null
  kind: string | null
  [key: string]: unknown
}

export interface NccState {
  ncc: NccVendor[]
  groups: NccGroup[]
  newGroups: NccGroup[]
  templates: unknown[]
  cfg: Record<string, string>
  log: unknown[]
  queue: unknown[]
  pending: NccOrder[]
  messages: NccMessage[]
  audit: unknown[]
  users: unknown[]
  deptList: { dept_id: string; name: string; color: string }[]
  me: {
    email: string
    name: string
    app_role: string
    dept_id: string
    isSuper: boolean
    viewAll: boolean
    director_global: boolean
  }
  confirm: { noreply: number; [key: string]: unknown }
  stats: { today: number; minute: number; queue: number; quiet: boolean }
}

export function useNccState() {
  return useQuery({
    queryKey: ['ncc-state'],
    queryFn: async () => (await nccApi.get<NccState>('/state')).data,
    refetchInterval: 8000,
  })
}

export interface NccHealth {
  ok: boolean
  gateway: { ok: boolean; session?: string | null }
  email: boolean
}

export function useGatewayHealth() {
  return useQuery({
    queryKey: ['ncc-health'],
    queryFn: async () => (await nccApi.get<NccHealth>('/health')).data,
    refetchInterval: 30000,
  })
}
