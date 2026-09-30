/**
 * 收藏统计的数据层。
 *
 * 统计页要的是**整份清单**（聚合必须看全量），所以这里自己翻页拉完：
 * 每页 100 条（Kana 上限），最多 `MAX_PAGES` 页兜底，避免异常数据把请求打爆。
 *
 * 字段集用 `ULIST_STATS_FIELDS`（只有年份 / 厂商 / 标签 / 打分），比清单页那套瘦得多。
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ULIST_STATS_FIELDS, ULIST_TAG_FIELDS } from "@/lib/api/fields";
import { queryList } from "@/lib/api/endpoints/ulist";
import type { UListItem } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { byGameType, type TypeBucket } from "./statsLogic";

/** 最多翻 20 页（2000 部），超过就不再往下拉 */
const MAX_PAGES = 20;
/** 每页条数（Kana 上限） */
const PAGE_SIZE = 100;

export function useCollectionStats(enabled: boolean): UseQueryResult<UListItem[]> {
  return useQuery({
    queryKey: queryKeys.ulist.stats(),
    enabled,
    staleTime: STALE_TIME.ulist,
    queryFn: async ({ signal }) => {
      const items: UListItem[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const response = await queryList({
          fields: ULIST_STATS_FIELDS,
          results: PAGE_SIZE,
          page,
          signal,
        });
        items.push(...response.results);
        if (!response.more) break;
      }
      return items;
    },
  });
}

/**
 * 游戏类型分布。
 *
 * 单独一个查询：`vn.tags.id` 比统计字段重得多（实测 100 条约 121 KB），
 * 类型饼图慢慢来就行，不该拖住年代 / 标签 / 厂商那几张图。
 * 聚合在 queryFn 里做完 —— 缓存里只留几块饼的数据，不留几千条标签。
 */
export function useGameTypeBuckets(enabled: boolean): UseQueryResult<TypeBucket[]> {
  return useQuery({
    queryKey: queryKeys.ulist.statsTypes(),
    enabled,
    staleTime: STALE_TIME.ulist,
    queryFn: async ({ signal }) => {
      const items: UListItem[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const response = await queryList({
          fields: ULIST_TAG_FIELDS,
          results: PAGE_SIZE,
          page,
          signal,
        });
        items.push(...response.results);
        if (!response.more) break;
      }
      return byGameType(items);
    },
  });
}
