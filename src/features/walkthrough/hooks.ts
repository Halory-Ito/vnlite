/**
 * 攻略模块的数据 hooks。
 *
 * 三级查询，**必须串起来**才能决定页签显示什么：
 *   1. `useWalkthroughIndex` —— 索引，决定这篇作品**有没有**攻略（不存在就到此为止）
 *   2. `useWalkthrough` —— 单篇正文，拿到路径后才发请求
 *   3. `useWalkthroughMarks` —— 本地标记（见 `use-marks.ts`）
 *
 * ⚠️ 第 2 级 `enabled` 依赖第 1 级的结果，所以「索引没加载完」和「这篇确实没有攻略」
 * 都会让它保持 idle —— 组件要用 `entry === undefined && index 已就绪` 区分这两种情况，
 * 否则会把「还没查」渲染成「没有攻略」。
 *
 * ## 缓存双层
 *
 * React Query（内存，staleTime 6h）+ AsyncStorage（落盘，见 `cache.ts`）。
 * 后者的作用有三个：进页签几乎零等待、**断网时仍能判断有没有攻略**、
 * 以及**打开即存**（Master 要求：看过的攻略直接落本地，不必手动点保存）。
 *
 * 网络失败会静默回落到过期缓存（不抛错），只有「既没网络又没缓存」才进错误态 ——
 * 攻略不是关键路径，值得看就看，不值得为它弹一个错误页。
 */

import { useQuery } from "@tanstack/react-query";

import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { readBodyCache, readIndexCache, writeBodyCache, writeIndexCache } from "./cache";
import { fetchWalkthrough, fetchWalkthroughIndex } from "./client";
import type { WalkthroughIndexEntry } from "./types";

export { useWalkthroughMarks } from "./use-marks";
export type { MarkField, WalkthroughMarks } from "./marks";
export type { WalkthroughMarkApi } from "./use-marks";

/**
 * 索引：先看落盘缓存，再后台刷新。
 *
 * `retry: false` —— 客户端内部已经在源之间降级过了（GitHub → jsDelivr），
 * 再叠加 React Query 的重试只是把等待拉长。
 */
export function useWalkthroughIndex(enabled = true) {
  return useQuery({
    queryKey: queryKeys.walkthrough.index(),
    enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const fresh = await fetchWalkthroughIndex(signal);
        await writeIndexCache(fresh);
        return fresh;
      } catch (error) {
        // 兜底：本地那份也比「没有攻略」这个结论可靠
        //（判断有没有攻略不能因为没网就变成错）
        const cached = await readIndexCache();
        if (cached) return cached.data;
        throw error;
      }
    },
    staleTime: STALE_TIME.walkthrough,
  });
}

/**
 * 单篇攻略。`entry` 为 undefined 时不请求（作品没有攻略，或索引还没到）。
 *
 * 调用方传的是索引里那一条 —— 路径必须用索引给的，不能按 vid 自己拼目录。
 */
export function useWalkthrough(entry: WalkthroughIndexEntry | undefined) {
  return useQuery({
    queryKey: queryKeys.walkthrough.byVn(entry?.vid ?? ""),
    enabled: Boolean(entry?.path),
    retry: false,
    queryFn: async ({ signal }) => {
      const vid = entry!.vid;
      try {
        const fresh = await fetchWalkthrough(vid, entry!.path, signal);
        // 打开即存（Master 要求）。`pinned` 交给 writeBodyCache 与已有状态取或，
        // 所以这里传 false 不会把「标记过」的篇目降级成可淘汰
        await writeBodyCache(vid, fresh);
        return fresh;
      } catch (error) {
        const cached = await readBodyCache(vid);
        if (cached) return cached.data;
        throw error;
      }
    },
    staleTime: STALE_TIME.walkthrough,
  });
}
