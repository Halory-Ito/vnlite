/**
 * 用户清单端点（`/ulist`、`/rlist`、`/ulist_labels`）与账号端点。
 *
 * ⚠️ 写操作有三个必须遵守的语义约束（否则会静默损坏用户数据）：
 *
 * 1. **`PATCH /ulist` 总会把 VN 加进清单。**
 *    哪怕你只想清空分数，一个不在清单里的 VN 也会被加进去。
 *    所以「更新」与「添加」必须区分：更新前先确认条目已存在。
 *
 * 2. **API 不会清理互斥标签。**
 *    vndb.org 网站会把 Playing/Finished/Stalled/Dropped 收敛成一个，
 *    直接 PATCH 不会。必须客户端自己保证。
 *
 * 3. **`DELETE /ulist/{id}` 会连带删除该 VN 的发行版条目，且不可逆。**
 *    移出清单前必须二次确认。
 */

import { EXCLUSIVE_STATUS_LABELS, UNSETTABLE_LABELS } from "../enums";
import { api } from "../client";
import { ULIST_FIELDS } from "../fields";
import { pred } from "../filters";
import {
  toFieldsString,
  type AuthInfo,
  type FieldSpec,
  type Predicate,
  type QueryResponse,
  type UListItem,
  type UListLabel,
  type UserInfo,
} from "../types";

/* -------------------------------------------------------------------------- */
/* 读                                                                         */
/* -------------------------------------------------------------------------- */

export interface UListQueryOptions {
  /** 读谁的清单。不传 = 已认证的自己的清单 */
  user?: string;
  filters?: Predicate | Predicate[];
  /** 覆盖默认字段集（统计页用更瘦的 `ULIST_STATS_FIELDS`） */
  fields?: readonly FieldSpec<UListItem>[];
  sort?:
    | "id"
    | "title"
    | "released"
    | "rating"
    | "votecount"
    | "voted"
    | "vote"
    | "added"
    | "lastmod"
    | "started"
    | "finished"
    | "searchrank";
  reverse?: boolean;
  results?: number;
  page?: number;
  count?: boolean;
  signal?: AbortSignal;
}

/** 读清单。`vote` 只能排序不能过滤（见 `filterByVote`） */
export function queryList(options: UListQueryOptions = {}): Promise<QueryResponse<UListItem>> {
  return api.query<UListItem>(
    "/ulist",
    {
      user: options.user ?? null,
      filters: options.filters,
      fields: toFieldsString(options.fields ?? ULIST_FIELDS),
      sort: options.sort ?? "added",
      reverse: options.reverse ?? true,
      results: Math.min(options.results ?? 25, 100),
      page: options.page ?? 1,
      count: options.count,
    },
    { signal: options.signal }
  );
}

/** 拉取自己的完整清单（本地库用，分页循环由调用方控制以便显示进度） */
export function fetchOwnListAll(
  options: { onProgress?: (loaded: number) => void; signal?: AbortSignal } = {}
): Promise<UListItem[]> {
  return fetchAll(1, [], options);
}

async function fetchAll(
  page: number,
  acc: UListItem[],
  options: { onProgress?: (loaded: number) => void; signal?: AbortSignal }
): Promise<UListItem[]> {
  const response = await queryList({
    page,
    results: 100,
    sort: "added",
    reverse: true,
    signal: options.signal,
  });
  const merged = acc.concat(response.results);
  options.onProgress?.(merged.length);
  if (!response.more || merged.length >= 5000) return merged;
  return fetchAll(page + 1, merged, options);
}

/** 读某人清单里的某个条目 */
export function getListItem(
  vnId: string,
  user?: string,
  signal?: AbortSignal
): Promise<QueryResponse<UListItem>> {
  return queryList({ user, filters: pred("id", "=", vnId), results: 1, signal });
}

/** 清单标签。不传 user = 当前认证用户的（含私有标签，需 listread 权限） */
export async function getListLabels(user?: string, signal?: AbortSignal): Promise<UListLabel[]> {
  const query = user ? `?user=${encodeURIComponent(user)}&fields=count` : "?fields=count";
  const response = await api.get<{ labels: UListLabel[] }>(`/ulist_labels${query}`, { signal });
  return response.labels;
}

/* -------------------------------------------------------------------------- */
/* 账号                                                                       */
/* -------------------------------------------------------------------------- */

/** 校验 Token 并取回权限。无有效 Token 会抛 401 */
export function authInfo(signal?: AbortSignal): Promise<AuthInfo> {
  return api.get<AuthInfo>("/authinfo", { signal, retry: false });
}

export function getUser(
  idOrName: string,
  signal?: AbortSignal
): Promise<Record<string, UserInfo & { lengthvotes?: number }>> {
  return api.get(`/user?id=${encodeURIComponent(idOrName)}`, { signal });
}

export function getStats(signal?: AbortSignal): Promise<{
  chars: number;
  producers: number;
  releases: number;
  staff: number;
  tags: number;
  traits: number;
  vn: number;
}> {
  return api.get("/stats", { signal });
}

/* -------------------------------------------------------------------------- */
/* 写                                                                         */
/* -------------------------------------------------------------------------- */

/** PATCH `/ulist` 的可写字段。`null` 表示清空 */
export interface UListPatch {
  /** 10–100 */
  vote?: number | null;
  notes?: string | null;
  /** YYYY-MM-DD */
  started?: string | null;
  finished?: string | null;
  /** ⚠️ 覆盖全部标签（不是追加）。用下面的辅助函数构造 */
  labels?: number[];
}

/** `PATCH /rlist` 的可写字段 */
export interface RListPatch {
  /** 0 未知 / 1 想要 / 2 已拥有 / 3 借出中 / 4 已删除 */
  status?: number;
}

/**
 * 清理待写入的标签集合。
 *
 * - 去掉虚拟标签（0 = No label，7 = Voted，随 vote 自动增删）
 * - 互斥的状态标签只保留最后一个（API 不会帮你收敛）
 * - 结果为「空」时返回 `[]` 而不是删键，因为要表达「清空所有标签」
 */
export function sanitizeLabels(labelIds: readonly number[]): number[] {
  const filtered = [...new Set(labelIds)].filter((id) => !UNSETTABLE_LABELS.includes(id));

  const statusLabels = filtered.filter((id) => EXCLUSIVE_STATUS_LABELS.includes(id));
  if (statusLabels.length > 1) {
    // 保留最后出现的那个，其余剔除
    const keep = statusLabels[statusLabels.length - 1] as number;
    return filtered.filter((id) => !EXCLUSIVE_STATUS_LABELS.includes(id) || id === keep);
  }
  return filtered;
}

/** 给已有标签追加一个（保留互斥收敛语义） */
export function addLabel(current: readonly number[], labelId: number): number[] {
  const next = EXCLUSIVE_STATUS_LABELS.includes(labelId)
    ? current.filter((id) => !EXCLUSIVE_STATUS_LABELS.includes(id))
    : [...current];
  return sanitizeLabels([...next, labelId]);
}

/** 从已有标签移除一个 */
export function removeLabel(current: readonly number[], labelId: number): number[] {
  return sanitizeLabels(current.filter((id) => id !== labelId));
}

/** 切换标签：已有则移除，没有则加上 */
export function toggleLabel(current: readonly number[], labelId: number): number[] {
  return current.includes(labelId) ? removeLabel(current, labelId) : addLabel(current, labelId);
}

/**
 * 添加或更新清单条目。
 *
 * ⚠️ 这是**会创建**条目的操作（PATCH 语义）。如果只是修改已存在的条目，
 * 请先用 `getListItem` 确认存在，否则会把不在清单里的 VN 意外加进来。
 */
export function addOrUpdateListItem(
  vnId: string,
  patch: UListPatch,
  signal?: AbortSignal
): Promise<void> {
  const body: UListPatch = { ...patch };
  if (body.labels) body.labels = sanitizeLabels(body.labels);
  return api.patch<void>(`/ulist/${vnId}`, body, { signal, retry: false });
}

/**
 * 更新**已存在**的条目。条目不存在时抛错，避免误创建。
 * 用法：先 `getListItem` 或传 `exists: true`。
 */
export async function updateExistingListItem(
  vnId: string,
  patch: UListPatch,
  exists: boolean,
  signal?: AbortSignal
): Promise<void> {
  if (!exists) throw new Error(`updateExistingListItem: ${vnId} 不在清单中，拒绝用 PATCH 意外添加`);
  return addOrUpdateListItem(vnId, patch, signal);
}

/**
 * 移出清单。
 * ⚠️ 会连带删除该 VN 的所有发行版持有记录，且不可逆。UI 必须二次确认。
 */
export function removeFromList(vnId: string, signal?: AbortSignal): Promise<void> {
  return api.delete(`/ulist/${vnId}`, { signal, retry: false });
}

/**
 * 设置发行版持有状态。
 * ⚠️ `PATCH /rlist` 会把该发行版关联的所有 VN 一并加入清单。
 */
export function setReleaseStatus(
  releaseId: string,
  status: number,
  signal?: AbortSignal
): Promise<void> {
  return api.patch<void>(`/rlist/${releaseId}`, { status }, { signal, retry: false });
}

/** 移除发行版持有记录 */
export function removeRelease(releaseId: string, signal?: AbortSignal): Promise<void> {
  return api.delete(`/rlist/${releaseId}`, { signal, retry: false });
}
