import { createAuthClient } from "better-auth/react"

const apiUrl = import.meta.env.PROD 
  ? window.location.origin 
  : "http://localhost:8787";

export const authClient = createAuthClient({
    baseURL: apiUrl
})