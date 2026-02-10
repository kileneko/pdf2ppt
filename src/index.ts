import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { cors } from "hono/cors";
import { auth } from "@/auth";
import { Bindings } from "@/bindings";
import { settingsRoute } from "@/routes/settings";
import { analyzeRoute } from "@/routes/analyze";
import adminRoute from "@/routes/admin";

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定 (認証を通すために credentials: true が必須)
app.use(
  "/*",
  cors({
    origin: (origin, c) => {
      // 環境変数から本番URLを取得
      const frontendUrl = (c.env as Bindings).FRONTEND_URL;
      
      const allowedOrigins = [
        "http://localhost:5173",
      ];

      // 環境変数があればリストに追加
      if (frontendUrl) {
        allowedOrigins.push(frontendUrl);
      }

      return allowedOrigins.includes(origin) ? origin : null;
    },
    
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Better-Auth のルートをマウント
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth(c.env).handler(c.req.raw);
});

// 各APIルートのマウント
const routes = app
  .route("/api/settings", settingsRoute)
  .route("/api/analyze", analyzeRoute)
  .route("/api/admin", adminRoute)
  .get("/*", serveStatic({ root: "./", manifest: {} }))
  .get("*", serveStatic({ path: "./index.html", manifest: {} }));

export default app;
export type AppType = typeof routes;