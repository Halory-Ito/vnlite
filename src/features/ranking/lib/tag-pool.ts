/**
 * 题材榜的**题材列表**：模块级共享状态（`useSyncExternalStore` 订阅，
 * 同 `features/sync/lib/configs/store` 的做法）。
 *
 * 基础候选来自 `/tag` 的内容大标签（见 `hooks/use-popular-tags`），
 * 但列表本身归用户：面板里可以删掉不关心的、把搜到的加进来。
 * 这里只持久化「用户的改动」——
 *   - `added`：自己加的题材（搜索结果）
 *   - `removed`：从基础候选里删除的 id（自动候选以后刷新也不会回来）
 *
 * 最终列表 = `mergeTagPool(基础候选, added, removed)`：
 * 基础候选照旧跟自动榜单走，用户的增删叠加在上面。
 */

import { kv } from "@/lib/storage/key-value";
import type { TagLite } from "@/lib/api/types";

export type { TagLite };

const ADDED_KEY = "ranking_tag_pool_added";
const REMOVED_KEY = "ranking_tag_pool_removed";

/**
 * 快照对象本身换而不是逐字段改 —— `useSyncExternalStore` 的 getSnapshot
 * 只有返回稳定的引用才不会死循环。
 */
const listeners = new Set<() => void>();
let state: TagPoolState = { added: [], removed: [], loaded: false };

export interface TagPoolState {
  /** 用户自己加的题材 */
  added: TagLite[];
  /** 从基础候选中删除的 id */
  removed: readonly string[];
  /** 首次读取是否完成 */
  loaded: boolean;
}

function emit(next: TagPoolState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** 订阅题材列表变化 */
export function subscribeTagPool(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 当前快照（引用稳定） */
export function getTagPoolState(): TagPoolState {
  return state;
}

/** 从 KV 读一次（「读一次」的承诺：已读到就不再发） */
export function loadTagPool(): Promise<void> {
  if (state.loaded) return Promise.resolve();
  return (async () => {
    const savedAdded = await kv.getOr<TagLite[]>(ADDED_KEY, []);
    const savedRemoved = await kv.getOr<string[]>(REMOVED_KEY, []);
    emit({
      added: Array.isArray(savedAdded) ? savedAdded.filter((tag) => tag?.id && tag.name) : [],
      removed: Array.isArray(savedRemoved)
        ? savedRemoved.filter((id) => typeof id === "string")
        : [],
      loaded: true,
    });
  })();
}

/**
 * 整合基础候选与用户改动（纯逻辑，冒烟直接测）。
 *
 * 顺序保持「基础候选 → 自加」；同一个 id 只留一次，`removed` 里的不出现。
 */
export function mergeTagPool(
  base: readonly TagLite[],
  added: readonly TagLite[],
  removed: readonly string[]
): TagLite[] {
  const hide = new Set(removed);
  const seen = new Set<string>();
  const pool: TagLite[] = [];
  for (const tag of [...base, ...added]) {
    if (hide.has(tag.id) || seen.has(tag.id)) continue;
    seen.add(tag.id);
    pool.push({ id: tag.id, name: tag.name });
  }
  return pool;
}

/**
 * 把题材加入列表（去重）。
 *
 * 之前被删掉的基础候选如果重新加回来，顺势撤销屏蔽 —— 用户明确要它就必须回来。
 */
export async function addPoolTags(tags: readonly TagLite[]): Promise<void> {
  if (tags.length === 0) return;
  const known = new Set(state.added.map((tag) => tag.id));
  const fresh = tags.filter(
    (tag, index, list) =>
      Boolean(tag.id) && !known.has(tag.id) && list.findIndex((x) => x.id === tag.id) === index
  );
  if (fresh.length === 0) return;
  const added = [...state.added, ...fresh.map((tag) => ({ id: tag.id, name: tag.name }))];
  const removed = state.removed.filter((id) => !fresh.some((tag) => tag.id === id));
  emit({ added, removed, loaded: state.loaded });
  await save(added, removed);
}

/**
 * 从列表移除题材：自己加的直接删掉；基础候选没有「重新拉一份」的概念，
 * 记进屏蔽名单，以后自动候选刷新也不会回来。
 */
export async function removePoolTags(
  ids: readonly string[],
  baseIds: readonly string[]
): Promise<void> {
  if (ids.length === 0) return;
  const base = new Set(baseIds);
  const droppedAdded = state.added.filter((tag) => !ids.includes(tag.id));
  const droppedRemoved = [...new Set([...state.removed, ...ids.filter((id) => base.has(id))])];
  if (droppedAdded.length === state.added.length && droppedRemoved.length === state.removed.length)
    return;
  emit({ added: droppedAdded, removed: droppedRemoved, loaded: state.loaded });
  await save(droppedAdded, droppedRemoved);
}

async function save(added: TagLite[], removed: string[]): Promise<void> {
  await kv.set(ADDED_KEY, added);
  await kv.set(REMOVED_KEY, removed);
}
