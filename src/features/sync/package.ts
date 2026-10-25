/**
 * 打包 / 恢复本地数据（IO 层）。
 *
 * ## 打包（导出）
 *
 * 读四份本地数据合成一个备份包：
 *   浏览历史 / 收藏 / 游玩记录（SQLite）+ 攻略标记（AsyncStorage）+ 应用偏好
 *
 * **不打包**：缓存（攻略正文与索引、每日语录）、登录信息（账号行 + VNDB Token）。
 * 缓存能重新下载；Token 是凭据，不该躺在服务器上。
 *
 * ## 恢复（导入）
 *
 * **整体替换**：本机的历史 / 收藏 / 游玩记录 / 攻略标记 / 偏好，
 * 全部换成备份里的内容。合并（两边都留）会让「恢复」变成「加一堆重复项」，
 * 与用户点这个按钮的预期不符 —— 所以是替换，且调用方必须先二次确认。
 */

import { getAllFavorites, replaceAllFavorites, type FavoriteType } from "@/lib/db/dao/favorite";
import { getAllHistory, replaceAllHistory, type HistoryType } from "@/lib/db/dao/history";
import { getAllPlaySessions, replaceAllPlaySessions } from "@/lib/db/dao/play-session";
import { kv } from "@/lib/storage/key-value";
import { getPreferences, replacePreferences } from "@/lib/storage/preferences";
import { MARKS_KEY_PREFIX } from "@/features/walkthrough/marks";

import {
  buildBackup,
  type BackupData,
  type BackupFavoriteEntry,
  type BackupHistoryEntry,
  type BackupPayload,
  type BackupPlaySession,
} from "./backup";

/** 收集攻略标记（vid → 标记内容） */
async function collectMarks(): Promise<Record<string, unknown>> {
  const keys = await kv.keys();
  const marks: Record<string, unknown> = {};
  for (const key of keys) {
    if (!key.startsWith(MARKS_KEY_PREFIX)) continue;
    const value = await kv.get(key);
    if (value === null || value === undefined) continue;
    marks[key.slice(MARKS_KEY_PREFIX.length)] = value;
  }
  return marks;
}

/** 读出本机的全部可同步数据 */
export async function collectBackupData(): Promise<BackupData> {
  const [history, favorite, playSession] = await Promise.all([
    getAllHistory(),
    getAllFavorites(),
    getAllPlaySessions(),
  ]);

  return {
    history: history.map<BackupHistoryEntry>((entry) => ({
      id: entry.id,
      type: entry.type,
      entryId: entry.entryId,
      title: entry.title,
      subtitle: entry.subtitle,
      imageUrl: entry.imageUrl,
      viewedAt: entry.viewedAt,
    })),
    favorite: favorite.map<BackupFavoriteEntry>((entry) => ({
      id: entry.id,
      type: entry.type,
      entryId: entry.entryId,
      title: entry.title,
      subtitle: entry.subtitle,
      imageUrl: entry.imageUrl,
      favoritedAt: entry.favoritedAt,
    })),
    playSession: playSession.map<BackupPlaySession>((session) => ({
      id: session.id,
      vnId: session.vnId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    })),
    preferences: { ...getPreferences() } as Record<string, unknown>,
    marks: await collectMarks(),
  };
}

/** 打一个完整的备份包 */
export async function createBackupPayload(): Promise<BackupPayload> {
  return buildBackup(await collectBackupData(), Date.now());
}

/** 用备份里的标记覆盖本地标记（本地多出来的删掉 —— 替换语义） */
async function restoreMarks(marks: Record<string, unknown>): Promise<void> {
  const keys = await kv.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith(MARKS_KEY_PREFIX)).map((key) => kv.remove(key))
  );
  await Promise.all(
    Object.entries(marks).map(([vid, value]) => kv.set(`${MARKS_KEY_PREFIX}${vid}`, value))
  );
}

/**
 * 把备份写回本地（整体替换）。
 *
 * 顺序：先写数据库（历史 / 收藏 / 游玩记录），再写标记与偏好 ——
 * 偏好放最后，因为它会立刻触发界面重渲染。
 */
export async function applyBackupData(data: BackupData): Promise<void> {
  await replaceAllHistory(
    data.history.map((entry) => ({
      id: entry.id,
      type: entry.type as HistoryType,
      entryId: entry.entryId,
      title: entry.title,
      subtitle: entry.subtitle,
      imageUrl: entry.imageUrl,
      viewedAt: entry.viewedAt,
    }))
  );
  await replaceAllFavorites(
    data.favorite.map((entry) => ({
      id: entry.id,
      type: entry.type as FavoriteType,
      entryId: entry.entryId,
      title: entry.title,
      subtitle: entry.subtitle,
      imageUrl: entry.imageUrl,
      favoritedAt: entry.favoritedAt,
    }))
  );
  await replaceAllPlaySessions(
    data.playSession.map((session) => ({
      id: session.id,
      vnId: session.vnId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMs: session.durationMs,
    }))
  );
  await restoreMarks(data.marks);
  await replacePreferences(data.preferences);
}

/** 恢复一个备份包 */
export async function restoreBackupPayload(payload: BackupPayload): Promise<void> {
  await applyBackupData(payload.data);
}
