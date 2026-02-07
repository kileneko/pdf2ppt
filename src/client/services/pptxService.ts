import pptxgen from "pptxgenjs";
import { SlideStructure } from "@/types";

export async function assemblePptx(slideData: SlideStructure[], fileName: string): Promise<string> {
  const pptx = new pptxgen();
  
  // 16:9 ワイドスクリーン設定 (13.33 x 7.5 inches)
  // 添付ファイルの設定: width: 13.33, height: 7.5
  pptx.defineLayout({ name: 'CUSTOM_16_9', width: 13.33, height: 7.5 });
  pptx.layout = 'CUSTOM_16_9';

  for (const data of slideData) {
    const slide = pptx.addSlide();
    
    // 背景色
    if (data.backgroundColor) {
        slide.background = { color: data.backgroundColor };
    }

    // 1. 背景図形
    if (data.elements.shapes) {
        data.elements.shapes.forEach(shape => {
            slide.addShape(pptx.ShapeType.rect, {
                x: shape.x,
                y: shape.y,
                w: shape.w,
                h: shape.h,
                fill: { color: shape.color || "FFFFFF" },
                line: { width: 0 }
            });
        });
    }

    // 2. 切り出された画像（イラスト・写真）
    // orderプロパティがある場合はソートして描画順を制御
    const sortedImages = [...(data.elements.images || [])].sort((a, b) => a.order - b.order);
    sortedImages.forEach(img => {
        let base64 = img.data;
        if (!base64.startsWith("data:image")) {
            base64 = `data:image/png;base64,${base64}`;
        }
        slide.addImage({
            data: base64,
            x: img.x,
            y: img.y,
            w: img.w,
            h: img.h
        });
    });

    // 3. テキスト（最前面）
    if (data.elements.text) {
        data.elements.text.forEach(text => {
            // ▼▼▼ 添付ファイルの強力なプロパティ設定を適用 ▼▼▼
            slide.addText(text.text, {
                x: text.x,
                y: text.y,
                w: text.w,
                h: text.h,
                
                // フォントスタイルの固定
                fontSize: text.fontSize,
                color: text.color,
                bold: text.isBold, // types定義に合わせる(bold -> isBold)
                align: text.align,
                valign: 'top',
                fontFace: 'Meiryo', // システムに標準的なフォントを固定指定
                
                // レイアウト特性の固定
                margin: [2, 5, 2, 5], // top, right, bottom, left
                wrap: true,
                
                // 【重要】マスターテーマの影響を回避する設定
                autoFit: false,    // テキスト量に応じた自動リサイズを無効化
                shrinkText: false, // 枠に収まらない場合の自動縮小を無効化
                placeholder: undefined, // 明示的にプレースホルダーとしての紐付けを解除
                
                // 行間の調整 (35はポイント指定に近いイメージ - 添付ファイルは32)
                lineSpacing: 32, 
            });
        });
    }
  }

  const finalName = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
  await pptx.writeFile({ fileName: finalName });
  return finalName;
}