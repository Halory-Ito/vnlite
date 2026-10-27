/**
 * 收藏本地持久化。
 *
 * VNDB 的 Kana API 没有通用收藏端点（`/ulist` 只覆盖作品），角色 / 制作人员 /
 * 用户 / 厂商的收藏无处可存，所以收藏一律**只落本地库**，与浏览历史同构。
 *
 * 存储层按**具体条目类型**区分（vn / character / staff / producer / user），
 * 查询接口按**类型集合**工作 —— 「人员」一档就是 `["character", "staff"]`，
 * 四个展示档位（作品 / 人员 / 用户 / 厂商）正好覆盖全部详情页。
 *
 * 同一条目重复收藏时**保留首次收藏时间**（`favorited_at` 不更新），只刷新元数据。
 */

import { getDatabase } from "@/lib/db/schema";

/** 收藏条目类型（存储层） */
export type FavoriteType = "vn" | "character" | "staff" | "producer" | "user";

export interface FavoriteEntry {
  id: number;
  type: FavoriteType;
  entryId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** unix 毫秒 */
  favoritedAt: number;
}

interface FavoriteRow {
  id: number;
  type: FavoriteType;
  entry_id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  favorited_at: number;
}

function parseRow(row: FavoriteRow): FavoriteEntry {
  return {
    id: row.id,
    type: row.type,
    entryId: row.entry_id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    favoritedAt: row.favorited_at,
  };
}

/** `IN (?, ?)` 的占位符，类型集合为空时返回 null 交给调用方短路 */
function placeholders(types: readonly FavoriteType[]): string | null {
  if (types.length === 0) return null;
  return types.map(() => "?").join(", ");
}

/**
 * 收藏一条。已收藏时只刷新元数据，**不覆盖** `favorited_at`
 * （再次点收藏不应把它顶到列表最前面）。
 */
export async function addFavorite(
  type: FavoriteType,
  entryId: string,
  title: string,
  subtitle?: string | null,
  imageUrl?: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO favorite (type, entry_id, title, subtitle, image_url, favorited_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(type, entry_id) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       image_url = excluded.image_url;`,
    type,
    entryId,
    title,
    subtitle ?? null,
    imageUrl ?? null,
    Date.now()
  );
}

/** 取消收藏 */
export async function removeFavorite(type: FavoriteType, entryId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM favorite WHERE type = ? AND entry_id = ?;`, type, entryId);
}

/** 某条目是否已收藏 */
export async function isFavorite(type: FavoriteType, entryId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM favorite WHERE type = ? AND entry_id = ?;`,
    type,
    entryId
  );
  return (row?.count ?? 0) > 0;
}

/**
 * 分页查询若干类型的收藏，按收藏时间倒序。
 */
export async function getFavoritesPage(
  types: readonly FavoriteType[],
  offset: number,
  limit: number
): Promise<FavoriteEntry[]> {
  const marks = placeholders(types);
  if (!marks) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<FavoriteRow>(
    `SELECT * FROM favorite WHERE type IN (${marks}) ORDER BY favorited_at DESC, id DESC LIMIT ? OFFSET ?;`,
    ...types,
    limit,
    offset
  );
  return rows.map(parseRow);
}

/** 若干类型的收藏总条数 */
export async function getFavoriteCount(types: readonly FavoriteType[]): Promise<number> {
  const marks = placeholders(types);
  if (!marks) return 0;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM favorite WHERE type IN (${marks});`,
    ...types
  );
  return row?.count ?? 0;
}

/**
 * 清空收藏。不传 `types` 清空全部。
 */
export async function clearFavorites(types?: readonly FavoriteType[]): Promise<void> {
  const db = await getDatabase();
  if (types) {
    const marks = placeholders(types);
    if (!marks) return;
    await db.runAsync(`DELETE FROM favorite WHERE type IN (${marks});`, ...types);
  } else {
    await db.runAsync(`DELETE FROM favorite;`);
  }
}

/**
 * 全部收藏（备份导出用）。
 *
 * 按收藏时间倒序，与列表页的排序一致 —— 恢复时按同样顺序写回，
 * 行号（`id`）的先后关系才不会乱。
 */
export async function getAllFavorites(): Promise<FavoriteEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FavoriteRow>(
    `SELECT * FROM favorite ORDER BY favorited_at DESC, id DESC;`
  );
  return rows.map(parseRow);
}

/**
 * 用备份**整体替换**本地收藏（先清空再写回，单事务）。
 *
 * `id` 大于 0 时保留原行号（列表排序以它作次级键，保留下来顺序才不会变）；
 * 为 0 时交给 SQLite 自己分配。
 */
export async function replaceAllFavorites(entries: readonly FavoriteEntry[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`DELETE FROM favorite;`);
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO favorite (id, type, entry_id, title, subtitle, image_url, favorited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        entry.id > 0 ? entry.id : null,
        entry.type,
        entry.entryId,
        entry.title,
        entry.subtitle ?? null,
        entry.imageUrl ?? null,
        entry.favoritedAt
      );
    }
  });
}
