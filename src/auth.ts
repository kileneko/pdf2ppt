import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { eq } from "drizzle-orm";
import { Bindings } from "./bindings";

export const auth = (env: Bindings) => {
  const isProduction = env.BETTER_AUTH_URL?.startsWith("https://");
  const db = drizzle(env.DB, { schema });

  const checkEmailAllowed = async (email: string) => {
    // 管理者チェック
    const admins = (env.ADMIN_EMAIL || "").split(",").map((e) => e.trim());
    if (admins.includes(email)) return true;

    // 許可リストチェック
    try {
      const allowed = await db
        .select()
        .from(schema.allowedUsers)
        .where(eq(schema.allowedUsers.email, email))
        .get();
      return !!allowed;
    } catch (e) {
      console.error("DB Check Error:", e);
      return false;
    }
  };

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    trustedOrigins: [
      "http://localhost:5173",
      ...(env.FRONTEND_URL ? [env.FRONTEND_URL] : []),
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
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const isAllowed = await checkEmailAllowed(user.email);
            if (!isAllowed) {
              console.error("🛑 [Hook: Create User] Check Error:", user.email);
              throw new APIError("FORBIDDEN", { message: "Registration is not allowed for this email." });
            }
            return { data: user };
          },
        },
      },
    },
  });
};