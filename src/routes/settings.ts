import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { userSecrets } from "@/db/schema";
import { auth } from "@/auth";
import { encrypt } from "@/lib/crypto";
import { Bindings } from "@/bindings";

const app = new Hono<{ Bindings: Bindings }>();

export const settingsRoute = app
  // 1. キーの保存・更新
  .post("/", async (c) => {
    const session = await auth(c.env).api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const userId = session.session.userId;

    const { apiKey } = await c.req.json<{ apiKey: string }>();
    if (!apiKey) return c.json({ error: "API Key is required" }, 400);
    
    // 暗号化
    const encryptedKey = await encrypt(apiKey, c.env.ENCRYPTION_KEY);
    const db = drizzle(c.env.DB);

    // DB保存処理
    const existingSecret = await db
      .select()
      .from(userSecrets)
      .where(eq(userSecrets.userId, userId))
      .get();

    if (existingSecret) {
      await db
        .update(userSecrets)
        .set({ encryptedGeminiKey: encryptedKey })
        .where(eq(userSecrets.userId, userId));
    } else {
      await db.insert(userSecrets).values({
        id: crypto.randomUUID(),
        userId: userId,
        encryptedGeminiKey: encryptedKey,
        createdAt: new Date(),
      });
    }

    return c.json({ success: true });
  })

  // 2. 設定状態の確認
  .get("/", async (c) => {
    const session = await auth(c.env).api.getSession({ headers: c.req.header() });
    if (!session) return c.json({ hasKey: false });
    const userId = session.session.userId;

    const db = drizzle(c.env.DB);
    const record = await db
      .select()
      .from(userSecrets)
      .where(eq(userSecrets.userId, userId))
      .get();

    return c.json({ hasKey: !!record });
  });