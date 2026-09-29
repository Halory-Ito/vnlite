/**
 * 账号信息本地持久化（单行表）。
 *
 * 只存 `GET /authinfo` 返回的 id / username / permissions 与登录时间，
 * **不存 Token** —— Token 走 `expo-secure-store`。
 */

import { getDatabase } from "../schema";
import type { Account } from "@/lib/storage/session";

interface AccountRow {
  id: string;
  username: string;
  permissions: string;
  logged_in_at: number;
  synced_at: number | null;
}

function parsePermissions(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export async function upsertAccount(account: Account): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO account (id, username, permissions, logged_in_at, synced_at)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       username = excluded.username,
       permissions = excluded.permissions,
       logged_in_at = excluded.logged_in_at;`,
    account.userId,
    account.username,
    JSON.stringify(account.permissions),
    account.loggedInAt
  );
}

/** 读回上次登录的账号（用于冷启动先渲染 UI，再异步校验 token） */
export async function getAccount(): Promise<Account | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AccountRow>("SELECT * FROM account LIMIT 1;");
  if (!row) return null;
  return {
    userId: row.id,
    username: row.username,
    permissions: parsePermissions(row.permissions),
    loggedInAt: row.logged_in_at,
  };
}

export async function getAccountSyncedAt(): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ synced_at: number | null }>(
    "SELECT synced_at FROM account LIMIT 1;"
  );
  return row?.synced_at ?? null;
}

/** 清单同步成功后打时间戳 */
export async function markSynced(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE account SET synced_at = ?;", Math.floor(Date.now() / 1000));
}

export async function clearAccount(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM account;");
}
