/**
 * 浏览历史本地持久化。
 *
 * 存储层按**具体条目类型**区分（vn / character / staff / producer / user），
 * 查询接口按**类型集合**工作 —— 「人员」一档就是 `["character", "staff"]`，
 * 这样四个展示档位（作品 / 人员 / 用户 / 厂商）能覆盖全部详情页。
 *
 * 同一条目再次浏览时**更新** `viewed_at` 而不是插入新行（唯一索引兜住）。
 */

import { getDatabase } from "../schema";

/** 历史条目类型（存储层） */
export type HistoryType = "vn" | "character" | "staff" | "producer" | "user";

export interface HistoryEntry {
  id: number;
  type: HistoryType;
  entryId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** unix 毫秒 */
  viewedAt: number;
}

interface HistoryRow {
  id: number;
  type: HistoryType;
  entry_id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  viewed_at: number;
}

function parseRow(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    type: row.type,
    entryId: row.entry_id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    viewedAt: row.viewed_at,
  };
}

/** `IN (?, ?)` 的占位符，类型集合为空时返回 null 交给调用方短路 */
function placeholders(types: readonly HistoryType[]): string | null {
  if (types.length === 0) return null;
  return types.map(() => "?").join(", ");
}

/**
 * 记录一次浏览。同一条目已存在时更新 `viewed_at`（去重）。
 */
export async function recordView(
  type: HistoryType,
  entryId: string,
  title: string,
  subtitle?: string | null,
  imageUrl?: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO history (type, entry_id, title, subtitle, image_url, viewed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(type, entry_id) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       image_url = excluded.image_url,
       viewed_at = excluded.viewed_at;`,
    type,
    entryId,
    title,
    subtitle ?? null,
    imageUrl ?? null,
    Date.now()
  );
}

/** 浏览时间的上下界（unix 毫秒，含边界）；null / 缺省 = 不限 */
export interface HistoryTimeBounds {
  since?: number | null;
  until?: number | null;
}

/** 组装 `type IN (…)` + 可选时间上下界的 WHERE 与参数 */
function buildWhere(
  types: readonly HistoryType[],
  bounds?: HistoryTimeBounds
): { where: string; params: unknown[] } | null {
  const marks = placeholders(types);
  if (!marks) return null;
  const params: unknown[] = [...types];
  let where = `type IN (${marks})`;
  if (bounds?.since != null) {
    where += ` AND viewed_at >= ?`;
    params.push(bounds.since);
  }
  if (bounds?.until != null) {
    where += ` AND viewed_at <= ?`;
    params.push(bounds.until);
  }
  return { where, params };
}

/**
 * 分页查询若干类型的历史，按浏览时间倒序。
 * `bounds` 给定时按浏览时间（unix 毫秒）过滤，上下界都可选。
 */
export async function getHistoryPage(
  types: readonly HistoryType[],
  offset: number,
  limit: number,
  bounds?: HistoryTimeBounds
): Promise<HistoryEntry[]> {
  const built = buildWhere(types, bounds);
  if (!built) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT * FROM history WHERE ${built.where} ORDER BY viewed_at DESC LIMIT ? OFFSET ?;`,
    ...built.params,
    limit,
    offset
  );
  return rows.map(parseRow);
}

/**
 * 若干类型的历史总条数（`bounds` 语义同 `getHistoryPage`）。
 */
export async function getHistoryCount(
  types: readonly HistoryType[],
  bounds?: HistoryTimeBounds
): Promise<number> {
  const built = buildWhere(types, bounds);
  if (!built) return 0;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM history WHERE ${built.where};`,
    ...built.params
  );
  return row?.count ?? 0;
}

/**
 * 清空历史。不传 `types` 清空全部。
 */
export async function clearHistory(types?: readonly HistoryType[]): Promise<void> {
  const db = await getDatabase();
  if (types) {
    const marks = placeholders(types);
    if (!marks) return;
    await db.runAsync(`DELETE FROM history WHERE type IN (${marks});`, ...types);
  } else {
    await db.runAsync(`DELETE FROM history;`);
  }
}

/**
 * 删除单条历史。
 */
export async function deleteHistoryEntry(type: HistoryType, entryId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM history WHERE type = ? AND entry_id = ?;`, type, entryId);
}
