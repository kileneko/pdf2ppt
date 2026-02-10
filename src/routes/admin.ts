import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { allowedUsers } from "../db/schema";
import { auth } from "../auth";
import { Bindings } from "../bindings";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono<{ Bindings: Bindings }>();

// メールアドレス追加用のスキーマ
const emailSchema = z.object({
  email: z.string().email(),
});

// ミドルウェア: 管理者かどうかチェック
app.use("*", async (c, next) => {
  const session = await auth(c.env).api.getSession({ headers: c.req.raw.headers });

  const admins = (c.env.ADMIN_EMAIL || "").split(",").map(e => e.trim());
  if (!session || !admins.includes(session.user.email)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

// 一覧取得
app.get("/users", async (c) => {
  const db = drizzle(c.env.DB);
  const list = await db.select().from(allowedUsers).all();
  return c.json(list);
});

// 追加
app.post("/users", zValidator("json", emailSchema), async (c) => {
  const { email } = c.req.valid("json");
  const db = drizzle(c.env.DB);
  
  try {
    await db.insert(allowedUsers).values({ email, createdAt: new Date() }).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Already exists or error" }, 400);
  }
});

// 削除
app.delete("/users", zValidator("json", emailSchema), async (c) => {
  const { email } = c.req.valid("json");
  const db = drizzle(c.env.DB);
  
  await db.delete(allowedUsers).where(eq(allowedUsers.email, email)).run();
  return c.json({ success: true });
});

export default app;