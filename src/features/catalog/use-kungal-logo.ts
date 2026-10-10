/**
 * 厂商 LOGO 的 React 绑定。
 *
 * 三种用法：
 *   - `useProducerLogoUrl(producer)` —— LOGO 组件 / 厂商详情页：按 producer 对象解析
 *     （官网域名优先、名称兜底），并**存进历史 / 收藏**（同一个 query 共用结果）
 *   - `useKungalNameLogo(title, subtitle)` —— 历史 / 收藏列表：条目里只有名称、
 *     没有 `extlinks` 时，用归一化名称在索引的 `names` 表里兜底
 *   - `useKungalLogoIndex()` —— 需要整份索引时
 *
 * 索引 129 KB、全应用共用一份（模块级 Promise + React Query 缓存），
 * 列表里每行挂 hook 也只是同一个 query 的多个订阅，不会重复加载。
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { Producer } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";

import {
  getKungalLogoIndex,
  lookupKungalLogoByName,
  resolveKungalLogo,
  type KungalLogoIndex,
} from "./kungal-logo";

export type { KungalLogoIndex };

/** 厂商 LOGO 基本不变，缓存一周 */
const PRODUCER_LOGO_STALE_TIME = 1000 * 60 * 60 * 24 * 7;

/** 整份索引（只加载一次，缓存不过期） */
export function useKungalLogoIndex() {
  return useQuery({
    queryKey: queryKeys.catalog.kungalIndex(),
    queryFn: getKungalLogoIndex,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * 按名称兜底解析 LOGO。
 *
 * 索引还没加载完时先返回 null（列表先画兜底图标，加载完自动换成 LOGO）。
 */
export function useKungalNameLogo(
  title: string | null | undefined,
  subtitle?: string | null
): string | null {
  const query = useKungalLogoIndex();
  return useMemo(() => {
    if (!query.data) return null;
    return lookupKungalLogoByName(query.data, [title, subtitle]);
  }, [query.data, title, subtitle]);
}

/**
 * 厂商对象 → LOGO URL。
 *
 * 同一个 producer id 共用一个 query（`["producer","logo",id]`）：
 * `ProducerLogo` 组件、详情页写历史、收藏按钮都从这里取，只解析一次。
 */
export function useProducerLogoUrl(producer: Producer | null | undefined): string | null {
  const query = useQuery({
    queryKey: queryKeys.catalog.producerLogo(producer?.id ?? ""),
    enabled: Boolean(producer?.id),
    queryFn: () => resolveKungalLogo(producer as Producer),
    staleTime: PRODUCER_LOGO_STALE_TIME,
    retry: false,
  });
  return query.data ?? null;
}
