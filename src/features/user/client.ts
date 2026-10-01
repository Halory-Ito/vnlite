/**
 * 用户模块的网络层：抓 VNDB 用户资料页。
 *
 * URL 是 `/{用户id}`（`u2` 这样的 id 自带前缀），跟讨论区的 `/t/v17` 不是一回事。
 * HTTP 逻辑（Cookie 挑战 / 限流退避）共用 `@/lib/scrape/client`。
 */

import { fetchVndbHtml } from "@/lib/scrape/client";

import { parseLengthVotes, parseUserProfile } from "./scrape";
import type { VndbLengthVote, VndbUserProfile } from "./scrape";

/** 游玩时长一页 */
export interface LengthVotePage {
  entries: VndbLengthVote[];
  hasMore: boolean;
}

/** 用户资料。`userId` 形如 `u2`；解析不出来返回 null（UI 显示空态） */
export async function fetchUserProfile(
  userId: string,
  signal?: AbortSignal
): Promise<VndbUserProfile | null> {
  const html = await fetchVndbHtml(`/${userId}`, signal);
  return parseUserProfile(html, userId);
}

/**
 * 某用户的游玩时长记录（`/u2/lengthvotes`）。
 *
 * 与 `fetchUserProfile` 分开请求：它不是每个用户都有记录（没提交过时长的人这页是空的），
 * 不该拖住资料页的首屏。翻页用 `rel="next"` 判断（页大小跟着官网变，不写死）。
 */
export async function fetchUserLengthVotes(
  userId: string,
  page = 1,
  signal?: AbortSignal
): Promise<LengthVotePage> {
  const query = page > 1 ? `?p=${page}` : "";
  const html = await fetchVndbHtml(`/${userId}/lengthvotes${query}`, signal);
  return {
    entries: parseLengthVotes(html),
    hasMore: /rel="next"/.test(html),
  };
}
