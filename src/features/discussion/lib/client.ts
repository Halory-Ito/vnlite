/**
 * 讨论模块的网络层：抓 VNDB 讨论板 / 帖子的 HTML 并解析。
 *
 * ⚠️ 走的是**网站 HTML**，不是 Kana API（API 没有讨论端点）。
 * 真正的 HTTP 逻辑（反爬 Cookie 挑战、限流退避）在 `@/lib/scrape/client`，
 * `features/user` 也在用那一套。
 */

import { fetchVndbHtml } from "@/lib/scrape/client";

import { parseThreadList, parseThreadPage } from "./scrape";
import type { ThreadListPage, ThreadPage } from "./scrape";

/** 某作品（或讨论板）的帖子列表；`page` 从 1 开始（每页 50 条） */
export async function fetchVnDiscussions(
  vnId: string,
  page = 1,
  signal?: AbortSignal
): Promise<ThreadListPage> {
  const query = page > 1 ? `?p=${page}` : "";
  const html = await fetchVndbHtml(`/t/${vnId}${query}`, signal);
  return parseThreadList(html);
}

/** 单个讨论帖的正文；每页 25 楼，`page` 从 1 开始（URL 形如 `/t950/2`） */
export async function fetchThread(
  threadId: string,
  page = 1,
  signal?: AbortSignal
): Promise<ThreadPage> {
  // ⚠️ `threadId` 自带 `t` 前缀（列表解析出来的 `t950`），这里**不能**再补 `/t/`
  const path = page > 1 ? `/${threadId}/${page}` : `/${threadId}`;
  const html = await fetchVndbHtml(path, signal);
  return parseThreadPage(html);
}
