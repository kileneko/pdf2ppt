// 暗号化アルゴリズム
const ALGORITHM = "AES-GCM";

// 文字列をArrayBufferに変換
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// キーの生成（環境変数から）
async function getCryptoKey(secret: string) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textEncoder.encode("salt-should-be-random-but-fixed-for-simple-app"), // 簡易化のため固定
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// 暗号化関数
export async function encrypt(text: string, secretEnv: string): Promise<string> {
  const key = await getCryptoKey(secretEnv);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 初期化ベクトル
  const encoded = textEncoder.encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  // IVと暗号文を結合してBase64にする
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// 復号関数
export async function decrypt(encryptedBase64: string, secretEnv: string): Promise<string> {
  const key = await getCryptoKey(secretEnv);
  const combined = new Uint8Array(
    atob(encryptedBase64).split("").map((c) => c.charCodeAt(0))
  );

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  return textDecoder.decode(decrypted);
}