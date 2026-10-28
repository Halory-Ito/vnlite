/**
 * 筛选状态里题材只存 **id**（`compileVnFilters` 拿 id 编谓词，缓存 key 也不掺名字），
 * 但展示的地方（筛选汇总条、面板）需要名字 —— 这里维护一份「id → 名字」字典：
 *
 *   - 面板里选中 / 快捷候选拿到的都是带名字的 TagLite，顺手 `recordTagNames()` 进来
 *   - KV 持久化（`browse_tag_names`），重开应用汇总条还是名字不是裸 id
 *   - 模块级 store + `useSyncExternalStore`（同 `ranking/lib/tag-pool` 的做法：
 *     快照整体换引用，getSnapshot 稳定才不会死循环）
 */

import { useSyncExternalStore } from "react";

import { kv } from "@/lib/storage/key-value";
import type { TagLite } from "@/lib/api/types";

const KEY = "browse_tag_names";

const listeners = new Set<() => void>();
let state: Record<string, string> = {};
let loaded = false;

function emit(next: Record<string, string>): void {
  state = next;
  for (const listener of listeners) listener();
}

/** 订阅字典变化 */
export function subscribeTagNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 当前快照（引用稳定） */
export function getTagNames(): Record<string, string> {
  return state;
}

/** 订阅字典（快照整体换引用，getSnapshot 稳定才不会死循环） */
export function useTagNames(): Record<string, string> {
  return useSyncExternalStore(subscribeTagNames, getTagNames);
}

/** 同步取名字（取不到返回 undefined，调用方自己 fallback 成 id） */
export function getTagName(id: string): string | undefined {
  return state[id];
}

/** 从 KV 读一次（读过了就不再发） */
export function loadTagNames(): Promise<void> {
  if (loaded) return Promise.resolve();
  return (async () => {
    const saved = await kv.getOr<Record<string, string>>(KEY, {});
    loaded = true;
    if (!saved || typeof saved !== "object") return;
    // 只认 g 开头的题材 id，其他键丢了没法编谓词
    const clean = Object.fromEntries(
      Object.entries(saved).filter(([id, name]) => id.startsWith("g") && typeof name === "string")
    );
    emit(clean);
  })();
}

/**
 * 记录一批题材名（只增不改 —— README / VNDB 的中英文名变化不常见，不值得覆盖逻辑）。
 * 记录一批题材名。名字以**首次见到**为准（只补缺，不覆盖已有的）：
 * 搜索 / 快捷推荐给的都是同一个 API 的名字，变化极罕见，省一次写盘。
 * 面板里每次把题材选中 / 加进组合时调用。
 */
export async function recordTagNames(tags: readonly TagLite[]): Promise<void> {
  const fresh: Record<string, string> = {};
  for (const tag of tags) {
    if (tag?.id?.startsWith("g") && tag.name && !state[tag.id]) fresh[tag.id] = tag.name;
  }
  const ids = Object.keys(fresh);
  if (ids.length === 0) return;
  const next = { ...state, ...fresh };
  emit(next);
  await kv.set(KEY, next);
}
