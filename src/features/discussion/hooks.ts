/**
 * 讨论模块的数据 hooks。
 *
 * 两个维度都要翻页：
 *   - 讨论板列表 `/t/v17?p=N`（每页 50 条）
 *   - 帖子正文 `/t950/2`（每页 25 楼）
 * 都用 `useInfiniteQuery`，页数放 `pageParam`。
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { fetchThread, fetchVnDiscussions } from "./client";
import type { VndbPost, VndbThread } from "./scrape";

/** 某作品 / 讨论板的帖子列表（无限翻页） */
export function useVnDiscussions(vnId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.discussion.vn(vnId),
    enabled: enabled && Boolean(vnId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchVnDiscussions(vnId, pageParam, signal),
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
    staleTime: STALE_TIME.vn,
  });
}

/** 单个讨论帖的正文（无限翻页） */
export function useThread(threadId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.discussion.thread(threadId),
    enabled: Boolean(threadId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchThread(threadId, pageParam, signal),
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
    staleTime: STALE_TIME.vn,
  });
}

/** 把分页结果拍平成一条帖子数组，交给列表组件 */
export function flattenThreads(pages: { threads: VndbThread[] }[] | undefined): VndbThread[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.threads);
}

/** 把分页结果拍平成楼层数组 */
export function flattenPosts(pages: { posts: VndbPost[] }[] | undefined): VndbPost[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.posts);
}

/** 拍平后的帖子数组（memo 化，避免每次渲染重建） */
export function useThreadList(
  vnId: string,
  enabled = true
): {
  query: ReturnType<typeof useVnDiscussions>;
  threads: VndbThread[];
} {
  const query = useVnDiscussions(vnId, enabled);
  const threads = useMemo(() => flattenThreads(query.data?.pages), [query.data]);
  return { query, threads };
}

/** 拍平后的楼层数组（memo 化） */
export function usePostList(threadId: string): {
  query: ReturnType<typeof useThread>;
  posts: VndbPost[];
} {
  const query = useThread(threadId);
  const posts = useMemo(() => flattenPosts(query.data?.pages), [query.data]);
  return { query, posts };
}
