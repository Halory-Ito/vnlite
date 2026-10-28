/**
 * 用户的**自定义题材列表** —— 排行榜的题材列表和浏览筛选的题材推荐
 * 用的是**同一份**（Master 要求两边一致）：
 *
 *   pool = 自动候选（作品数前 24 的内容标签，见 `use-popular-tags`）
 *          ∪ 用户自己搜加的 − 用户删掉的（候选删掉会进屏蔽名单）
 *
 * 状态与持久化都在 `@/features/ranking/lib/tag-pool`（KV：
 * `ranking_tag_pool_added` / `ranking_tag_pool_removed`），这里只做**装配**：
 * 把自动候选与用户改动合并成一份数组交给两个使用方。
 */

import { useEffect, useMemo } from "react";

import { useTagPool } from "@/features/ranking/hooks";
import { loadTagPool, mergeTagPool } from "@/features/ranking/lib/tag-pool";
import type { TagLite } from "@/lib/api/types";

import { usePopularTags } from "./use-popular-tags";

export interface CustomTagsState {
  /** 整合后的题材列表（自动候选 ∪ 自加 − 已删除） */
  pool: TagLite[];
  /** 自动候选的 id（判断删除语义：候选删掉进屏蔽名单、自加的直接删） */
  baseIds: string[];
  /** 自动候选是否还没读到（读到的瞬间推荐从空列表变为完整） */
  poolLoading: boolean;
}

export function useCustomTags(): CustomTagsState {
  // 题材列表存在 KV 里，进来读一次（已读过就直接返回，幂等）
  useEffect(() => {
    void loadTagPool();
  }, []);

  const popular = usePopularTags();
  const poolState = useTagPool();

  const pool = useMemo(
    () => mergeTagPool(popular.data ?? [], poolState.added, poolState.removed),
    [popular.data, poolState.added, poolState.removed]
  );
  const baseIds = useMemo(() => (popular.data ?? []).map((tag) => tag.id), [popular.data]);

  return { pool, baseIds, poolLoading: popular.isLoading };
}
