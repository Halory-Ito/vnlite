/**
 * 攻略的本地缓存（AsyncStorage）。
 *
 * ## 为什么攻略要落盘，而 VNDB 业务数据不落
 *
 * 攻略仓库是**纯静态 JSON**，一次下载之后几乎不变（更新日期以月计）；
 * 而 VNDB 条目偶尔会改、且体积大得多。两者的缓存诉求正好相反。
 *
 * 具体到这一份数据：
 *   - 索引 ~190KB：决定「这篇作品到底有没有攻略」。**每次进详情页都要判断**，
 *     不落盘的话等于每点一次「攻略」页签就重下 190KB。
 *   - 单篇 1KB–94KB：看过 / 标记过的作品要能离线再打开。
 *
 * ⚠️ 缓存**不按时间淘汰**：什么时候重新请求完全交给 React Query 的
 * `STALE_TIME.walkthrough` 决定，AsyncStorage 这里只负责「有没有一份可用的」。
 * 所以断网时索引仍然可用（「这篇有攻略」这个判断不能因为没网就变成错）。
 *
 * ## 钉住（pinned）：标记过的攻略不参与淘汰
 *
 * 用户在攻略里打了标记，就说明这东西他要反复回来对照。LRU 淘汰只动没标记的，
 * 否则「清缓存」和「淘汰」会悄悄吃掉用户的进度。
 * ⚠️ 与此对应的是 `marks.ts` 用**独立的键**存标记 ——
 * 设置页「清空浏览缓存」清得掉正文，清不掉标记。
 *
 * ## 淘汰
 *
 * 索引只留 1 份。单篇按 vid 各存一份，没钉住的保留 `MAX_AUTO` 篇，
 * 超了从最久没看的开始删 —— 不设上限的话看几十部作品就能攒到几 MB。
 * 钉住的不设上限：用户数据被自动删除比多占几 MB 磁盘糟糕得多。
 */

import { kv } from "@/lib/storage/key-value";

import type { Walkthrough, WalkthroughIndex } from "./types";

const INDEX_KEY = "vnlite.walkthrough_index";
/** 清单：记录各 vid 的最近访问与钉住状态，供淘汰用（正文另存，避免单键反复重写几 MB） */
const LEDGER_KEY = "vnlite.walkthrough_ledger";
/** 标记的键前缀 —— 清缓存时**必须跳过**它们 */
const MARKS_PREFIX = "vnlite.walkthrough_marks.";

/** 未钉住的单篇最多留几篇 */
export const MAX_AUTO = 20;

/** 索引的落盘记录（只留 1 份，所以不需要 id） */
export interface IndexEntry {
  /** 写入时间（仅供排查，刷新时机由 React Query 的 staleTime 决定） */
  at: number;
  data: WalkthroughIndex;
}

export interface BodyEntry {
  /** 写入时间（仅供排查，刷新时机由 React Query 的 staleTime 决定） */
  at: number;
  data: Walkthrough;
  /** 钉住：标记过，不参与 LRU 淘汰 */
  pinned: boolean;
}

/** 淘汰清单里的一项 */
export interface LedgerEntry {
  vid: string;
  /** 最近访问时间（毫秒时间戳） */
  accessedAt: number;
  pinned: boolean;
}

/**
 * 纯函数：该淘汰哪些 vid（只动没钉住的）。
 *
 * 排序必须在副本上做 —— Hermes 没有 `toSorted`，而入参是缓存里的数组。
 */
export function overflowVids(ledger: readonly LedgerEntry[], max: number): string[] {
  const evictable = ledger.filter((entry) => !entry.pinned);
  if (evictable.length <= max) return [];
  return evictable
    .sort((a, b) => a.accessedAt - b.accessedAt)
    .slice(0, evictable.length - max)
    .map((entry) => entry.vid);
}

const bodyKey = (vid: string): string => `vnlite.walkthrough.body.${vid}`;

/* -------------------------------------------------------------------------- */
/* 索引                                                                        */
/* -------------------------------------------------------------------------- */

export async function readIndexCache(): Promise<IndexEntry | null> {
  return kv.get<IndexEntry>(INDEX_KEY);
}

export async function writeIndexCache(index: WalkthroughIndex): Promise<void> {
  await kv.set<IndexEntry>(INDEX_KEY, { at: Date.now(), data: index });
}

/* -------------------------------------------------------------------------- */
/* 单篇                                                                        */
/* -------------------------------------------------------------------------- */

export async function readBodyCache(vid: string): Promise<BodyEntry | null> {
  return kv.get<BodyEntry>(bodyKey(vid));
}

/**
 * 写入单篇（打开即存）。
 *
 * `pinned` 只允许从 false 升到 true：从缓存回填时传 false 不该把已钉住的降级，
 * 所以这里取「已钉住」与传入值的**或**。
 */
export async function writeBodyCache(
  vid: string,
  data: Walkthrough,
  pinned = false
): Promise<void> {
  const now = Date.now();
  const previous = await readBodyCache(vid);
  const entry: BodyEntry = { at: now, data, pinned: pinned || previous?.pinned === true };
  await kv.set<BodyEntry>(bodyKey(vid), entry);
  await touchLedger(vid, entry.pinned, now);
  if (entry.pinned) pinnedInSession.add(vid);
  else pinnedInSession.delete(vid);
}

/**
 * 本进程内已知「已钉住」的 vid。
 *
 * ⚠️ 这个集合是性能关键，不是可有可无的优化：
 * `pinWalkthrough` 原本每次调用都要 `readBodyCache` —— 从 AsyncStorage
 * 取出**整篇正文**（最大的一篇 137KB）再 JSON.parse，只为了看一眼
 * `pinned` 是不是 true。而 `use-marks` 的**每一次打标记**都会调它，
 * 于是「点一下复选框」=「从原生 SQLite 里捞 137KB 字符串 + 解析」。
 * 已经钉住之后仍然要再读一遍，纯粹白花。
 *
 * 钉住只会 false → true，且同一进程内不会反向变化，所以进程内记一份就够。
 */
const pinnedInSession = new Set<string>();

/** 把某篇钉为「永不淘汰」（打第一个标记时调用） */
export async function pinWalkthrough(vid: string): Promise<void> {
  if (pinnedInSession.has(vid)) return;

  const entry = await readBodyCache(vid);
  if (!entry) return;
  if (entry.pinned) {
    // 之前就已经钉住了（比如这次会话早些时候打开时写进去的）
    pinnedInSession.add(vid);
    return;
  }

  await kv.set<BodyEntry>(bodyKey(vid), { ...entry, pinned: true });
  await touchLedger(vid, true, Date.now());
  pinnedInSession.add(vid);
}

/** 维护清单 + 淘汰。⚠️ 记账失败不该让「写入成功」变成失败，所以这里吞掉异常 */
async function touchLedger(vid: string, pinned: boolean, now: number): Promise<void> {
  try {
    const ledger = (await kv.get<LedgerEntry[]>(LEDGER_KEY)) ?? [];
    const next: LedgerEntry[] = [
      { vid, accessedAt: now, pinned },
      ...ledger.filter((entry) => entry.vid !== vid),
    ];
    const stale = overflowVids(next, MAX_AUTO);
    await Promise.all(stale.map((old) => kv.remove(bodyKey(old))));
    await kv.set(
      LEDGER_KEY,
      next.filter((entry) => !stale.includes(entry.vid))
    );
  } catch {
    // 缓存只是加速手段，记账失败无所谓
  }
}

/**
 * 设置页「清空浏览缓存」用。
 *
 * ⚠️ **不动标记**（`MARKS_PREFIX`）。标记是用户数据，不是缓存 ——
 * 「清缓存」清掉进度会非常意外。
 */
export async function clearWalkthroughCache(): Promise<void> {
  pinnedInSession.clear();
  const keys = await kv.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("vnlite.walkthrough") && !key.startsWith(MARKS_PREFIX))
      .map((key) => kv.remove(key))
  );
}
