import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { userSecrets } from "../db/schema";
import { decrypt } from "../lib/crypto";
import { auth } from "../auth";
import { Bindings } from "../bindings";

const requestSchema = z.object({
  image: z.string(),
  mode: z.enum(["BALANCED", "TEXT_FOCUS", "COMPONENTS", "FULL_IMAGE"]).default("BALANCED"),
});

const getW = (b: number[]) => ((b[3] - b[1]) / 1000) * 13.33 * 1.25;
const getH = (b: number[]) => ((b[2] - b[0]) / 1000) * 7.5 * 1.1;
const getX = (b: number[]) => (b[1] / 1000) * 13.33;
const getY = (b: number[]) => (b[0] / 1000) * 7.5;

const app = new Hono<{ Bindings: Bindings }>();

export const analyzeRoute = app.post(
  "/",
  zValidator("json", requestSchema),
  async (c) => {
    const session = await auth(c.env).api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const { image, mode } = c.req.valid("json");

    const db = drizzle(c.env.DB);
    const secretRecord = await db
      .select()
      .from(userSecrets)
      .where(eq(userSecrets.userId, session.user.id))
      .get();

    if (!secretRecord) return c.json({ error: "API Key not found" }, 400);

    try {
      const decryptedKey = await decrypt(secretRecord.encryptedGeminiKey, c.env.ENCRYPTION_KEY);
      const genAI = new GoogleGenerativeAI(decryptedKey);

      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    backgroundColor: { type: SchemaType.STRING },
                    visual_parts: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                type: { type: SchemaType.STRING },
                                box: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                                order: { type: SchemaType.NUMBER }
                            }
                        }
                    },
                    text_blocks: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                text: { type: SchemaType.STRING },
                                box: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                                fontSize: { type: SchemaType.NUMBER },
                                color: { type: SchemaType.STRING },
                                bold: { type: SchemaType.BOOLEAN },
                                align: { type: SchemaType.STRING }
                            }
                        }
                    },
                    shapes: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                type: { type: SchemaType.STRING },
                                box: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
                                color: { type: SchemaType.STRING },
                                order: { type: SchemaType.NUMBER }
                            }
                        }
                    }
                }
            }
        },
      });

      // ▼▼▼ 添付ファイルのプロンプト構築ロジック ▼▼▼
      let specificInstruction = "";
      switch (mode) {
        case "TEXT_FOCUS":
          specificInstruction = `
          【モード：レイアウト重視 (TEXT_FOCUS)】
          1. 図形(shapes)は一切抽出しないでください。
          2. 視覚的なイラストや背景はすべて、スライド全体(box: [0, 0, 1000, 1000])を1つの「visual_parts」として定義してください。
          3. テキストのみを正確に抽出し、その上に配置するようにしてください。
          `;
          break;
        case "BALANCED":
          specificInstruction = `
          【モード：標準ハイブリッド (BALANCED)】
          1. 四角形や背景の帯などの単純な図形のみ「shapes」として抽出してください。
          2. 複雑なイラスト、アイコン、吹き出し、ロゴ、写真は「visual_parts」として、意味のある単位で個別の画像として切り出すように指示してください。
          `;
          break;
        case "COMPONENTS":
          specificInstruction = `
          【モード：パーツ分離 (COMPONENTS)】
          1. あらゆる視覚要素（アイコン、小さな装飾等）を、可能な限り個別の「visual_parts」として分離して抽出してください。
          `;
          break;
      }

      const systemInstruction = `
      あなたは「PowerPoint完全再現エンジニア」です。
      提供された画像を解析し、PowerPointスライドの構成案（JSON）を出力してください。

      共通ルール:
      - テキストは意味のある段落ごとに統合し、内部改行は "\\n" を使用。
      - テキストボックスの横幅は、日本語フォントのレンダリング誤差を考慮し、視覚的な幅よりも25%ほど広く定義してください。
      - 座標系は 0-1000 (ymin, xmin, ymax, xmax)。
      
      ${specificInstruction}
      `;
      // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

      const base64Data = image.split(",")[1] || image;
      const result = await model.generateContent({
        contents: [
            { role: "user", parts: [
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
                { text: "このスライドを解析し、JSONを出力してください。" }
            ]}
        ],
        systemInstruction: systemInstruction
      });

      const response = await result.response;
      let dna;
      try {
        dna = JSON.parse(response.text());
      } catch (e) {
        throw new Error("AI解析結果のパースに失敗しました");
      }

      // ▼▼▼ 添付ファイルの変換ロジックを適用 ▼▼▼
      
      // 1. Shapesの変換
      const shapes = (dna.shapes || []).map((s: any) => ({
        type: 'rect',
        x: getX(s.box),
        y: getY(s.box),
        w: getW(s.box),
        h: getH(s.box),
        color: (s.color || 'FFFFFF').replace('#', ''),
        order: s.order || 10
      }));

      // 2. Textの変換
      const text = (dna.text_blocks || []).map((t: any) => ({
        text: t.text,
        x: getX(t.box),
        y: getY(t.box),
        w: getW(t.box),
        h: getH(t.box),
        fontSize: t.fontSize || 18,
        color: (t.color || '#000000').replace('#', ''),
        bold: t.bold || false,
        align: t.align || 'left',
      }));

      // 3. 画像切り抜き指示 (visual_parts)
      // サーバー側では切り抜けないため、Home.tsxで切り抜くための情報を返す
      // ただし、座標計算はここで行う必要はない（切り抜き自体は元画像の1000分率で行うため）
      const rawImageInstructions = (dna.visual_parts || []).map((p: any) => ({
        description: p.type || "image",
        box: p.box, // [ymin, xmin, ymax, xmax]
        order: p.order || 20
      }));

      // クライアントへ返す
      return c.json({
        backgroundColor: (dna.backgroundColor || 'FFFFFF').replace('#', ''),
        elements: {
            shapes,
            text,
            images: [] // 画像データはまだ無い（クライアントで作る）
        },
        rawImageInstructions // クライアント側で cropElement する用
      });

    } catch (e: any) {
      console.error("Analysis Error:", e);
      return c.json({ error: "Analysis Failed", details: e.message }, 500);
    }
  }
);