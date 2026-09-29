/**
 * 用户清单的本地持久化。
 *
 * 数据流：
 *   服务端 `/ulist` ──全量拉取──▶ 本地表 ──▶ UI（离线可读）
 *   UI 写操作 ──▶ 乐观更新本地表（dirty=1）──▶ PATCH /ulist ──▶ 成功则清 dirty
 *
 * 「添加」与「更新」的区分很重要：PATCH 总会创建条目，所以 UI 侧要决定
 * 走哪条路（见 `endpoints/ulist.ts` 的 `addOrUpdateListItem` / `updateExistingListItem`）。
 */

import type { UListItem, UListLabel, UListRelease, VnSummary } from "@/lib/api/types";

import { getDatabase } from "../schema";

export interface LocalUListRow {
  vnId: string;
  vote: number | null;
  notes: string | null;
  added: number | null;
  voted: number | null;
  lastmod: number | null;
  started: string | null;
  finished: string | null;
  labels: number[];
  releases: UListRelease[];
  vn: VnSummary | null;
  dirty: boolean;
  syncedAt: number | null;
}

interface RawRow {
  vn_id: string;
  vote: number | null;
  notes: string | null;
  added: number | null;
  voted: number | null;
  lastmod: number | null;
  started: string | null;
  finished: string | null;
  labels: string;
  releases: string;
  vn: string;
  dirty: number;
  synced_at: number | null;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toRow(raw: RawRow): LocalUListRow {
  return {
    vnId: raw.vn_id,
    vote: raw.vote,
    notes: raw.notes,
    added: raw.added,
    voted: raw.voted,
    lastmod: raw.lastmod,
    started: raw.started,
    finished: raw.finished,
    labels: parseJson<number[]>(raw.labels, []),
    releases: parseJson<UListRelease[]>(raw.releases, []),
    vn: parseJson<VnSummary | null>(raw.vn, null),
    dirty: raw.dirty === 1,
    syncedAt: raw.synced_at,
  };
}

const toUListItem = (row: LocalUListRow): UListItem => ({
  id: row.vnId,
  vote: row.vote,
  notes: row.notes,
  added: row.added ?? undefined,
  voted: row.voted,
  lastmod: row.lastmod ?? undefined,
  started: row.started,
  finished: row.finished,
  labels: row.labels.map((id) => ({ id, label: "" })),
  releases: row.releases,
  vn: row.vn ?? undefined,
});

/* -------------------------------------------------------------------------- */
/* 读                                                                         */
/* -------------------------------------------------------------------------- */

export async function getAllListRows(): Promise<LocalUListRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>("SELECT * FROM ulist ORDER BY added DESC;");
  return rows.map(toRow);
}

export async function getAllListItems(): Promise<UListItem[]> {
  return (await getAllListRows()).map(toUListItem);
}

export async function getListRow(vnId: string): Promise<LocalUListRow | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawRow>("SELECT * FROM ulist WHERE vn_id = ?;", vnId);
  return row ? toRow(row) : null;
}

export async function countListRows(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM ulist;");
  return row?.n ?? 0;
}

/** 有本地改动未回写的条目 */
export async function getDirtyRows(): Promise<LocalUListRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>("SELECT * FROM ulist WHERE dirty = 1;");
  return rows.map(toRow);
}

/* -------------------------------------------------------------------------- */
/* 写                                                                         */
/* -------------------------------------------------------------------------- */

/** 用服务端返回的条目覆盖本地（以服务端为准），清 dirty */
export async function upsertFromServer(item: UListItem): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO ulist
       (vn_id, vote, notes, added, voted, lastmod, started, finished, labels, releases, vn, dirty, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(vn_id) DO UPDATE SET
       vote     = excluded.vote,
       notes    = excluded.notes,
       added    = excluded.added,
       voted    = excluded.voted,
       lastmod  = excluded.lastmod,
       started  = excluded.started,
       finished = excluded.finished,
       labels   = excluded.labels,
       releases = excluded.releases,
       vn       = excluded.vn,
       dirty    = 0,
       synced_at = excluded.synced_at;`,
    item.id,
    item.vote ?? null,
    item.notes ?? null,
    item.added ?? null,
    item.voted ?? null,
    item.lastmod ?? null,
    item.started ?? null,
    item.finished ?? null,
    JSON.stringify((item.labels ?? []).map((l) => l.id)),
    JSON.stringify(item.releases ?? []),
    JSON.stringify(item.vn ?? null),
    Math.floor(Date.now() / 1000)
  );
}

/** 全量同步：清表后批量写入 */
export async function replaceAllFromServer(items: readonly UListItem[]): Promise<number> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM ulist;");
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO ulist
           (vn_id, vote, notes, added, voted, lastmod, started, finished, labels, releases, vn, dirty, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?);`,
        item.id,
        item.vote ?? null,
        item.notes ?? null,
        item.added ?? null,
        item.voted ?? null,
        item.lastmod ?? null,
        item.started ?? null,
        item.finished ?? null,
        JSON.stringify((item.labels ?? []).map((l) => l.id)),
        JSON.stringify(item.releases ?? []),
        JSON.stringify(item.vn ?? null),
        now
      );
    }
  });
  return items.length;
}

/** 乐观更新：只改本地，标 dirty，等 PATCH 成功后再 clearDirty */
export async function patchLocal(
  vnId: string,
  patch: {
    vote?: number | null;
    notes?: string | null;
    started?: string | null;
    finished?: string | null;
    labels?: number[];
    releases?: UListRelease[];
  },
  vn?: VnSummary
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<RawRow>("SELECT * FROM ulist WHERE vn_id = ?;", vnId);
  if (!existing) throw new Error(`patchLocal: ${vnId} 不在本地清单中`);

  const merged: RawRow = {
    ...existing,
    vote: patch.vote !== undefined ? patch.vote : existing.vote,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    started: patch.started !== undefined ? patch.started : existing.started,
    finished: patch.finished !== undefined ? patch.finished : existing.finished,
    labels: patch.labels !== undefined ? JSON.stringify(patch.labels) : existing.labels,
    releases: patch.releases !== undefined ? JSON.stringify(patch.releases) : existing.releases,
    vn: vn !== undefined ? JSON.stringify(vn) : existing.vn,
  };

  await db.runAsync(
    `UPDATE ulist SET
       vote = ?, notes = ?, started = ?, finished = ?, labels = ?, releases = ?, vn = ?,
       lastmod = ?, dirty = 1
     WHERE vn_id = ?;`,
    merged.vote,
    merged.notes,
    merged.started,
    merged.finished,
    merged.labels,
    merged.releases,
    merged.vn,
    Math.floor(Date.now() / 1000),
    vnId
  );
}

/** 本地新增一条（用户第一次把某个 VN 加进清单） */
export async function insertLocal(item: UListItem): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO ulist
       (vn_id, vote, notes, added, voted, lastmod, started, finished, labels, releases, vn, dirty, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
     ON CONFLICT(vn_id) DO NOTHING;`,
    item.id,
    item.vote ?? null,
    item.notes ?? null,
    item.added ?? Math.floor(Date.now() / 1000),
    item.voted ?? null,
    item.lastmod ?? null,
    item.started ?? null,
    item.finished ?? null,
    JSON.stringify((item.labels ?? []).map((l) => l.id)),
    JSON.stringify(item.releases ?? []),
    JSON.stringify(item.vn ?? null)
  );
}

/** PATCH 成功后调用 */
export async function clearDirty(vnId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE ulist SET dirty = 0, synced_at = ? WHERE vn_id = ?;",
    Math.floor(Date.now() / 1000),
    vnId
  );
}

/** 回滚：把本地行恢复成服务端版本（失败时调用） */
export async function rollbackToServer(item: UListItem): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE ulist SET
       vote = ?, notes = ?, added = ?, voted = ?, lastmod = ?, started = ?, finished = ?,
       labels = ?, releases = ?, vn = ?, dirty = 0, synced_at = ?
     WHERE vn_id = ?;`,
    item.vote ?? null,
    item.notes ?? null,
    item.added ?? null,
    item.voted ?? null,
    item.lastmod ?? null,
    item.started ?? null,
    item.finished ?? null,
    JSON.stringify((item.labels ?? []).map((l) => l.id)),
    JSON.stringify(item.releases ?? []),
    JSON.stringify(item.vn ?? null),
    Math.floor(Date.now() / 1000),
    item.id
  );
}

/** 移出清单（对应 `DELETE /ulist/{id}`） */
export async function removeLocal(vnId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM ulist WHERE vn_id = ?;", vnId);
}

/* -------------------------------------------------------------------------- */
/* 标签                                                                       */
/* -------------------------------------------------------------------------- */

export async function replaceAllLabels(labels: readonly UListLabel[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM ulist_label;");
    for (const label of labels) {
      await db.runAsync(
        "INSERT INTO ulist_label (id, label, private, count) VALUES (?, ?, ?, ?);",
        label.id,
        label.label,
        label.private ? 1 : 0,
        (label as UListLabel & { count?: number }).count ?? null
      );
    }
  });
}

export async function getAllLabels(): Promise<UListLabel[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    label: string;
    private: number;
    count: number | null;
  }>("SELECT id, label, private, count FROM ulist_label ORDER BY id;");
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    private: r.private === 1,
    ...(r.count != null ? { count: r.count } : {}),
  }));
}

/** 标签 id → 名称，供本地渲染（本地表不存 label 字符串） */
export async function getLabelMap(): Promise<Map<number, string>> {
  const labels = await getAllLabels();
  return new Map(labels.map((l) => [l.id, l.label]));
}
