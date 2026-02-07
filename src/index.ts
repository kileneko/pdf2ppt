import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@/auth";
import { Bindings } from "@/bindings";
import { settingsRoute } from "@/routes/settings";
import { analyzeRoute } from "@/routes/analyze";

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
  .get("*", async (c, next) => {
    // 1. APIへのアクセスなら何もしない（次の処理へ）
    if (c.req.path.startsWith("/api/")) {
      return next();
    }

    // 2. Cloudflareの ASSETS バインディングを使ってファイルを探す
    // @ts-ignore (型定義がない場合のエラー回避)
    const assets = c.env.ASSETS;
    
    if (assets) {
      // リクエストされたファイルをそのまま探す (例: /style.css)
      const res = await assets.fetch(c.req.raw);
      
      // 見つかればそれを返す (200 OK)
      if (res.status < 400) {
        return res;
      }

      // 3. 見つからなければ index.html を返す (SPAの画面遷移対応)
      // どんなURLで来ても、Reactのトップページ(index.html)を返してあげる
      const indexUrl = new URL("/index.html", c.req.url);
      const indexRes = await assets.fetch(new Request(indexUrl, c.req.raw));
      return indexRes;
    }

    return next();
  });

export default app;
export type AppType = typeof routes;