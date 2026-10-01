/**
 * 用户模块的数据 hooks。
 *
 * 三路数据，各有各的来源与脾气：
 *   1. 资料页 —— 抓 HTML（`GET /user` 那点字段不够看）
 *   2. 全部投票 —— **Kana API**（`/ulist?user=…`，服务端驱动、可靠）
 *   3. 游玩时长 —— 抓 HTML（`/ulist` 根本没有时长字段）
 *
 * 2 和 3 都要翻页（各 50 / 25 一页），都用 `useInfiniteQuery`。
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryUserVotes } from "@/lib/api/endpoints/ulist";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { fetchUserLengthVotes, fetchUserProfile } from "./client";
import type { VndbLengthVote } from "./scrape";

/** 每页条数 */
const VOTE_PAGE_SIZE = 50;

/** 某用户资料页 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.user.profile(userId),
    enabled: Boolean(userId),
    queryFn: ({ signal }) => fetchUserProfile(userId, signal),
    staleTime: STALE_TIME.catalog,
  });
}

/**
 * 某用户打过分的作品（无限翻页）。
 *
 * 过滤在**服务端**做（虚拟标签 7「已打分」），所以每一页都是有效打分记录，
 * 不用本地筛、也不会翻到「全是愿望单条目」的页。
 */
export function useUserVotes(userId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.user.votes(userId),
    enabled: enabled && Boolean(userId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      queryUserVotes({
        user: userId,
        results: VOTE_PAGE_SIZE,
        page: pageParam,
        signal,
      }),
    getNextPageParam: (lastPage, allPages) => (lastPage.more ? allPages.length + 1 : undefined),
    staleTime: STALE_TIME.ulist,
  });
}

/** 游玩时长记录（无限翻页）。失败不影响投票列表，静默降级成「无时长」 */
export function useUserLengthVotes(userId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.user.lengthVotes(userId),
    enabled: enabled && Boolean(userId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchUserLengthVotes(userId, pageParam, signal),
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
    staleTime: STALE_TIME.catalog,
    retry: false,
  });
}

/** 把打过分的条目摊平（服务端已按标签 7 过滤，这里直接拍平） */
export function useUserVoteItems(userId: string, enabled = true) {
  const query = useUserVotes(userId, enabled);
  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.results),
    [query.data]
  );
  return { query, items };
}

/**
 * 游玩时长按 vnId 建索引（同一作品有多次记录时取**最近**的一条 ——
 * lengthvotes 表默认按日期倒序，先到先得）。
 */
export function useLengthVoteMap(userId: string, enabled = true): Map<string, VndbLengthVote> {
  const query = useUserLengthVotes(userId, enabled);
  return useMemo(() => {
    const map = new Map<string, VndbLengthVote>();
    for (const page of query.data?.pages ?? []) {
      for (const entry of page.entries) {
        if (!map.has(entry.vnId)) map.set(entry.vnId, entry);
      }
    }
    return map;
  }, [query.data]);
}
