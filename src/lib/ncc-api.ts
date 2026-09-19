// NCC Hub v3 — client gọi API thật (admin/routes/*.js), same-origin /api/*.
// Đính Bearer header (localStorage tmg_token) như app.js cũ — cookie same-origin đã tự gửi kèm,
// Bearer là fallback cho trường hợp cookie bị coi third-party.
import axios from 'axios'
import { nccAuthHeaders } from './ncc-auth'

export const nccApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

nccApi.interceptors.request.use((config) => {
  const h = nccAuthHeaders()
  if (h.Authorization) config.headers.set('Authorization', h.Authorization)
  return config
})
