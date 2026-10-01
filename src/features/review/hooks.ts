/**
 * 评价模块的 React hooks。
 *
 * 缓存策略与讨论 / 用户模块一致：走抓取，内容几乎不变，
 * 所以 staleTime 用 `STALE_TIME.catalog`（30 分钟），失败不自动重试
 * （抓取被限流时重试只会更糟，错误态给手动重试按钮）。
 */

import { useQuery } from "@tanstack/react-query";

import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { fetchLatestReviews, fetchReview } from "./client";

/** 最新评价列表（`/w`）；`limit` 只截前端展示条数，不影响请求 */
export function useLatestReviews(limit: number) {
  return useQuery({
    queryKey: queryKeys.review.list(limit),
    queryFn: ({ signal }) => fetchLatestReviews(signal),
    staleTime: STALE_TIME.catalog,
    retry: false,
    select: (data) => data.reviews.slice(0, limit),
  });
}

/** 单条评价详情 */
export function useReview(reviewId: string) {
  return useQuery({
    queryKey: queryKeys.review.detail(reviewId),
    enabled: Boolean(reviewId),
    queryFn: ({ signal }) => fetchReview(reviewId, signal),
    staleTime: STALE_TIME.catalog,
    retry: false,
  });
}
