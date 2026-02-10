import type { D1Database } from "@cloudflare/workers-types";

export type Bindings = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ENCRYPTION_KEY: string;
  ADMIN_EMAIL: string;
  BETTER_AUTH_URL?: string;
  FRONTEND_URL?: string;
};