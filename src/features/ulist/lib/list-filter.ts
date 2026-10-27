/**
 * 清单列表的纯逻辑：标签筛选。
 *
 * 单独成文件而不是塞进 `hooks.ts`：这里不依赖 React，
 * 冒烟脚本可以直接 import（`hooks.ts` 拉的是 @tanstack/react-query）。
 */

import type { UListItem } from "@/lib/api/types";

/**
 * 条目是否属于某个标签。
 *
 * 与 Kana 的 `label` 过滤器同一套语义：条目的 `labels` 里含这个 id 就算命中。
 * 虚拟标签（0 = No label、7 = Voted）不会出现在 `labels` 里，UI 也不给筛。
 */
export function itemHasLabel(item: UListItem, labelId: number): boolean {
  return (item.labels ?? []).some((label) => label.id === labelId);
}

/**
 * 在**已加载**的条目里按标签筛选（Master 要求：清单整份拉回来后本地筛，
 * 切换零请求、零 loading）。
 *
 * `labelId` 为 null = 全部（返回副本，别把缓存里的数组直接交出去）。
 *
 * ⚠️ 只能筛「已经加载」的那些：列表是分页的（50 一页），所以 UI 要在筛选态下
 * 说明「已加载 N 条里筛出 M 条」并给一个补齐下一页的入口。
 */
export function filterByLabel(items: readonly UListItem[], labelId: number | null): UListItem[] {
  if (labelId == null) return [...items];
  return items.filter((item) => itemHasLabel(item, labelId));
}
