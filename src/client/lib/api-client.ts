import { hc } from 'hono/client'
import type { AppType } from '@/index' 

// フロントエンドからバックエンドへの接続設定
const apiUrl = import.meta.env.VITE_API_URL || '/' 
export const client = hc<AppType>(apiUrl, {
  // 常に credentials: 'include' (Cookie送信) を付ける
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: 'include',
    })
  }
})