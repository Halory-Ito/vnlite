/**
 * 抓取 VNDB **网站 HTML** 时的共用纯函数。
 *
 * 为什么需要它：Kana API 没有讨论 / 帖子 / 用户资料端点，这些内容只存在于网站
 * HTML，所以 `features/discussion` 与 `features/user` 都要解析同一个站点的页面。
 * 共用的那部分（实体解码、去标签、挑战页识别）收在这里，各 feature 只写自己的
 * 结构解析。
 */

/** 常用 HTML 实体解码（含数字实体），够覆盖标题 / 楼层里会出现的那些 */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code: string) => {
    switch (code) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      case "nbsp":
        return " ";
      default:
        break;
    }
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const n = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    if (code.startsWith("#")) {
      const n = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return whole;
  });
}

/** 去标签 + 解实体 + 收敛空白，得到可直接上屏的纯文本 */
export function toText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** VNDB 的「Checking browser」反爬挑战页（503 + 种 Cookie 的图片） */
export function isBrowserChallenge(html: string): boolean {
  return html.includes("Checking browser") || html.includes("totally-innocent-logo-image");
}

/** VNDB 对抓取请求的**限流**页（503「Crawlers are not permitted」） */
export function isCrawlerBlocked(html: string): boolean {
  return html.includes("Crawlers are not permitted");
}

/** 从挑战页里取出那张用来种 Cookie 的图片地址（相对路径） */
export function extractChallengeImage(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}
