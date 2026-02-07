import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { Bindings } from "@/bindings";

// 環境変数の型定義
export const auth = (env: Bindings) => {
  const isProduction = env.BETTER_AUTH_URL?.startsWith("https://");

  return betterAuth({
    database: drizzleAdapter(drizzle(env.DB), {
      provider: "sqlite",
      schema: schema, 
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    trustedOrigins: [
        "http://localhost:5173", 
        ...(env.FRONTEND_URL ? [env.FRONTEND_URL] : [])
    ],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    advanced: {
        defaultCookieAttributes: {
            sameSite: isProduction ? "None" : "Lax", 
            secure: isProduction 
        }
    }
  });
};