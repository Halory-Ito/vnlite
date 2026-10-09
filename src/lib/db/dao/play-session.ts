/**
 * 游玩记录本地持久化（SQLite）。
 *
 * 游戏计时器每「结束」一次写一条：记录了会话的墙钟起止与**实际游玩时长**
 * （`duration_ms` 不含暂停，由计时器累计）。
 *
 * 归属某作品，按开始时间倒序查询；统计聚合在 `features/play-records/play-stats`
 * 里纯函数完成（数据量小，直接全量取回本地算）。
 */

import { getDatabase } from "../schema";

export interface PlaySession {
  id: number;
  vnId: string;
  /** 会话开始（unix 毫秒） */
  startedAt: number;
  /** 会话结束（unix 毫秒） */
  endedAt: number;
  /** 实际游玩时长（毫秒，不含暂停） */
  durationMs: number;
}

/** 新增一条记录时用（无 id） */
export type NewPlaySession = Omit<PlaySession, "id">;

interface PlaySessionRow {
  id: number;
  vn_id: string;
  started_at: number;
  ended_at: number;
  duration_ms: number;
}

function parseRow(row: PlaySessionRow): PlaySession {
  return {
    id: row.id,
    vnId: row.vn_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
  };
}

/** 写入一条游玩记录 */
export async function insertPlaySession(session: NewPlaySession): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO play_session (vn_id, started_at, ended_at, duration_ms)
     VALUES (?, ?, ?, ?);`,
    session.vnId,
    session.startedAt,
    session.endedAt,
    session.durationMs
  );
}

/** 某作品的全部游玩记录（开始时间倒序） */
export async function getPlaySessions(vnId: string): Promise<PlaySession[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PlaySessionRow>(
    `SELECT * FROM play_session WHERE vn_id = ? ORDER BY started_at DESC;`,
    vnId
  );
  return rows.map(parseRow);
}

/** 删除单条记录 */
export async function deletePlaySession(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM play_session WHERE id = ?;`, id);
}

/** 某作品的全部游玩记录清空（「我的 → 清空」用得上时再说，先备着） */
export async function clearPlaySessions(vnId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM play_session WHERE vn_id = ?;`, vnId);
}
