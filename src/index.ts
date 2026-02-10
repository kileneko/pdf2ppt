import { Hono } from "hono";
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
  .get("/*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) {
      return next();
    }

    // @ts-ignore: 型定義がない場合のエラー回避
    const assets = c.env.ASSETS;

    if (!assets) {
      // ローカル開発環境などでASSETSがない場合
      return next();
    }

    // リクエストされたファイルをそのまま探す (例: /style.css)
    let res = await assets.fetch(c.req.raw);

    // 見つかればそれを返す (200 OK)
    if (res.status < 400) {
      return res;
    }

    // 404かつ、ファイル拡張子がない（=画面遷移）なら index.html を返す (SPA対応)
    if (res.status === 404 && !c.req.path.includes(".")) {
      const url = new URL(c.req.url);
      url.pathname = "/index.html";
      // index.html を取りに行く
      res = await assets.fetch(new Request(url, c.req.raw));
      return res;
    }

    // それでもなければ 404
    return next();
  });

export default app;
export type AppType = typeof routes;