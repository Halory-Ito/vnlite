/**
 * 评价模块的网络层：抓 VNDB 网站的评价列表 / 单条评价 HTML 并解析。
 *
 * ⚠️ 走的是**网站 HTML**，不是 Kana API（API 没有评价端点，见 `scrape.ts` 顶部）。
 * HTTP 逻辑（反爬 Cookie 挑战、限流退避）复用 `@/lib/scrape/client`
 * —— 与讨论、用户两个模块同一套。
 */

import { fetchVndbHtml } from "@/lib/scrape/client";

import { parseReviewList, parseReviewPage } from "./scrape";
import type { ReviewListPage, VndbReviewDetail } from "./scrape";

/**
 * 最新评价列表。
 *
 * 抓的是 `/w`（Browse reviews，默认按发布时间倒序），不是首页那一栏：
 * 列表页是规整的数据表（能翻页），首页那段是版面拼出来的，解析更脆。
 * 每页 50 条，调用方自己截前 N 条。
 */
export async function fetchLatestReviews(signal?: AbortSignal): Promise<ReviewListPage> {
  const html = await fetchVndbHtml("/w", signal);
  return parseReviewList(html);
}

/**
 * 单条评价。
 *
 * ⚠️ `reviewId` 自带 `w` 前缀（列表解析出来的 `w18526`），这里**不能**再补 `/w/`。
 * 解析失败（官网改版）返回 null，交给 UI 走空态。
 */
export async function fetchReview(
  reviewId: string,
  signal?: AbortSignal
): Promise<VndbReviewDetail | null> {
  const html = await fetchVndbHtml(`/${reviewId}`, signal);
  return parseReviewPage(html, reviewId);
}
