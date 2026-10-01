/**
 * 首页信息流的数据 hooks。
 *
 * 两档发售列表都是「按日期」的数据，所以 queryKey 里带**本地日期**：
 * 跨零点后 key 变了会自动重取（否则「即将发售」会一直停在昨天那批）。
 */

import { useQuery } from "@tanstack/react-query";

import { queryJustReleasedVns, queryUpcomingVns } from "@/lib/api/endpoints/vn";
import type { VnSummary } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { todayIso } from "@/utils/format";

import { FEED_COUNT } from "./feed-config";

/** 即将发售：`released > 今天`，按发售日升序（TBA 已被端点层排掉） */
export function useUpcomingVns() {
  const day = todayIso();
  return useQuery({
    queryKey: queryKeys.home.upcoming(day),
    queryFn: ({ signal }) => queryUpcomingVns(day, FEED_COUNT, signal),
    staleTime: STALE_TIME.vn,
    select: (data) => data.results as VnSummary[],
  });
}

/** 最新发售：`released <= 今天`，按发售日降序 */
export function useJustReleasedVns() {
  const day = todayIso();
  return useQuery({
    queryKey: queryKeys.home.justReleased(day),
    queryFn: ({ signal }) => queryJustReleasedVns(day, FEED_COUNT, signal),
    staleTime: STALE_TIME.vn,
    select: (data) => data.results as VnSummary[],
  });
}
