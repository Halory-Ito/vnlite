/**
 * 「相似作品」的数据层（作品页「相似」页签）。
 *
 * 流程很短：拿本作的标签（`pickSimilarTags` 挑内容标签）→ `or(byTag…)` 查作品
 * → 按评分降序 → 去掉本作自己。
 *
 * 不读用户收藏、也不写库：换台设备、没登录，看到的结果都一样。
 */

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { and, byTag, or, pred } from "@/lib/api/filters";
import { queryVns } from "@/lib/api/endpoints/vn";
import type { VnSummary, VnTag } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { excludeIds, pickSimilarTags } from "@/features/recommend/lib/recommend";

/** 一次取多少部候选 */
const MAX_RESULTS = 30;
/** 评分门槛：低于 60 分的作品不值得推荐 */
const MIN_RATING = 60;
/** 最多用几个标签去查 */
const TAG_LIMIT = 4;

/**
 * 与某部作品相似的作品。
 *
 * @param vn 当前作品（详情页拿到的 `VnDetail`，标签取 `tags.*`）
 */
export function useSimilarVns(vn: { id: string; tags?: VnTag[] }): UseQueryResult<VnSummary[]> {
  const tags = useMemo(() => pickSimilarTags(vn, TAG_LIMIT), [vn]);
  const tagKey = tags.map((tag) => tag.id).join(",");

  return useQuery({
    queryKey: queryKeys.similar.list(vn.id, tagKey),
    enabled: tags.length > 0,
    staleTime: STALE_TIME.catalog,
    queryFn: async ({ signal }) => {
      const response = await queryVns({
        filters: and(or(...tags.map((tag) => byTag(tag.id))), pred("rating", ">=", MIN_RATING)),
        sort: "rating",
        reverse: true,
        results: MAX_RESULTS,
        signal,
      });

      return excludeIds(response.results, new Set([vn.id]));
    },
  });
}
