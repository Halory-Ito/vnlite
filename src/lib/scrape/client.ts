/**
 * 抓取 VNDB **网站 HTML** 的 HTTP 层（Kana API 覆盖不到的内容走这里）。
 *
 * ## 两道坎
 *
 * 1. **反爬挑战**：首次请求返回 503「Checking browser」页 + 一张图片，
 *    图片响应里种下 `xbotcheck` Cookie，带着 Cookie 重试才拿到真实页面。
 *    Cookie 走**双保险**：手动 Cookie 罐（`getSetCookie` 可读时用，如 bun）
 *    + React Native 的原生 cookie jar（移动端自动带同源 Cookie）。
 * 2. **抓取限流**：请求太密会拿到 503「Crawlers are not permitted」页，
 *    会持续几分钟。这里识别出来 → 退避一下重试，仍不行就抛明确错误，
 *    免得 UI 显示成「解析失败」这种误导信息。
 */

import { VNDB_WEB_BASE } from "@/constants/config";

import { extractChallengeImage, isBrowserChallenge, isCrawlerBlocked } from "./html";

/** 手动 Cookie 罐（读不到 set-cookie 的环境靠原生 jar，这里就空着） */
const cookies = new Map<string, string>();

function cookieHeader(): string | null {
  if (cookies.size === 0) return null;
  return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorbCookies(response: Response): void {
  const list = response.headers.getSetCookie?.() ?? [];
  for (const raw of list) {
    const pair = raw.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 单次 HTML 请求（自动带 cookie） */
async function requestHtml(
  url: string,
  signal?: AbortSignal
): Promise<{ status: number; text: string }> {
  const cookie = cookieHeader();
  const response = await fetch(url, {
    method: "GET",
    signal,
    // 移动端 fetch 不允许自定义 User-Agent（见 constants/config 注释），这里只声明接受 HTML
    headers: { Accept: "text/html", ...(cookie ? { Cookie: cookie } : {}) },
  });
  absorbCookies(response);
  return { status: response.status, text: await response.text() };
}

/** 站点 URL：站内绝对路径拼上域名 */
export function vndbUrl(path: string): string {
  return path.startsWith("http") ? path : `${VNDB_WEB_BASE}${path}`;
}

/** 遇限流时的退避（1.2s / 3s），最多两次 */
const BLOCK_BACKOFF_MS = [1200, 3000];

/**
 * 抓一个 VNDB 网页路径，依次处理「反爬挑战」与「抓取限流」。
 * 都处理不了就抛错，交给 React Query 的错误态。
 */
export async function fetchVndbHtml(path: string, signal?: AbortSignal): Promise<string> {
  const url = vndbUrl(path);

  for (let attempt = 0; attempt <= BLOCK_BACKOFF_MS.length; attempt += 1) {
    let { status, text } = await requestHtml(url, signal);

    if (isBrowserChallenge(text)) {
      const image = extractChallengeImage(text);
      if (image) {
        // 这一步只为让服务端把 xbotcheck 种进 cookie（手动罐 + 原生 jar 都受益）
        await requestHtml(vndbUrl(image), signal);
        ({ status, text } = await requestHtml(url, signal));
      }
    }

    if (isCrawlerBlocked(text)) {
      const wait = BLOCK_BACKOFF_MS[attempt];
      if (wait != null) {
        await sleep(wait);
        continue;
      }
      throw new Error("VNDB 暂时限制了抓取请求，等几分钟再试");
    }

    if (isBrowserChallenge(text)) throw new Error("VNDB 的反爬验证没通过，稍后再试");
    if (status >= 400) throw new Error(`VNDB 网页请求失败（HTTP ${status}）`);
    return text;
  }

  throw new Error("VNDB 暂时限制了抓取请求，等几分钟再试");
}
