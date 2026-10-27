/**
 * base64 编码（HTTP Basic 认证用）。
 *
 * RN / Hermes **没有 `btoa`**（`react-native` 核心只在自己的 TextInput 里用到一个），
 * `base64-js` 又是 `react-native` 的传递依赖、不是本项目的直接依赖 ——
 * 哪天依赖树变了它就没了。所以自带一份（纯函数，冒烟可直接测）。
 *
 * 中文 / emoji 也要能编码：先转 UTF-8 字节再 base64。
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** 字符串 → UTF-8 字节数组 */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  // `for...of` 按码点迭代（代理对会作为一个码点出来）
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/** base64 编码（带 `=` 补位） */
export function base64Encode(text: string): string {
  const bytes = utf8Bytes(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const hasSecond = b1 !== undefined;
    const hasThird = b2 !== undefined;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | (hasSecond ? b1 >> 4 : 0)];
    out += hasSecond ? ALPHABET[((b1 & 0x0f) << 2) | (hasThird ? b2 >> 6 : 0)] : "=";
    out += hasThird ? ALPHABET[b2 & 0x3f] : "=";
  }
  return out;
}

/** `user:password` → Basic 认证头的值 */
export function basicAuthValue(username: string, password: string): string {
  return `Basic ${base64Encode(`${username}:${password}`)}`;
}
