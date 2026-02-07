import { hc } from 'hono/client'
import type { AppType } from '@/index' 

const apiUrl = import.meta.env.PROD 
  ? window.location.origin 
  : "http://localhost:8787";

export const client = hc<AppType>(apiUrl, {
  // 常に credentials: 'include' (Cookie送信) を付ける
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: 'include',
    })
  }
})