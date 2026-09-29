/**
 * SQLite 初始化与迁移。
 *
 * ⚠️ 按 C1 决策：**只存用户自己的数据**。VNDB 业务数据（VN / release /
 * character / producer / staff / tag / trait / quote）一律不进库，实时走 API。
 *
 * 这张表很小（典型 100–2000 行），所以全量读进内存再在 JS 层做筛选/排序/
 * 搜索都是可接受的，不必把复杂查询下推到 SQL。
 */

import * as SQLite from "expo-sqlite";

const DB_NAME = "vnlite.db";

/** 迁移列表：按顺序执行，索引即版本号 */
const MIGRATIONS: string[][] = [
  // v1 —— 初始结构
  [
    `CREATE TABLE IF NOT EXISTS account (
      id            TEXT PRIMARY KEY NOT NULL,
      username      TEXT NOT NULL,
      permissions   TEXT NOT NULL,          -- JSON 数组
      logged_in_at  INTEGER NOT NULL,
      synced_at     INTEGER
    );`,

    `CREATE TABLE IF NOT EXISTS ulist_label (
      id       INTEGER PRIMARY KEY NOT NULL,
      label    TEXT NOT NULL,
      private  INTEGER NOT NULL DEFAULT 0,
      count    INTEGER
    );`,

    `CREATE TABLE IF NOT EXISTS ulist (
      vn_id      TEXT PRIMARY KEY NOT NULL,
      vote       INTEGER,                   -- 10–100，null = 未打分
      notes      TEXT,
      added      INTEGER,                   -- unix 秒
      voted      INTEGER,
      lastmod    INTEGER,
      started    TEXT,                      -- YYYY-MM-DD
      finished   TEXT,
      labels     TEXT NOT NULL DEFAULT '[]',-- JSON 数字数组
      releases   TEXT NOT NULL DEFAULT '[]',-- JSON: {id,title,list_status,...}[]
      vn         TEXT NOT NULL,             -- JSON: 冗余的 VN 摘要，离线可显示
      dirty      INTEGER NOT NULL DEFAULT 0,-- 1 = 有待回写的本地改动
      synced_at  INTEGER
    );`,

    `CREATE INDEX IF NOT EXISTS idx_ulist_vote ON ulist (vote DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_ulist_added ON ulist (added DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_ulist_released ON ulist (started);`,
    `CREATE INDEX IF NOT EXISTS idx_ulist_dirty ON ulist (dirty);`,
  ],

  // v2 —— 预留：待写队列
  // [
  //   `CREATE TABLE IF NOT EXISTS ulist_pending (
  //     id        INTEGER PRIMARY KEY AUTOINCREMENT,
  //     vn_id     TEXT NOT NULL,
  //     patch     TEXT NOT NULL,
  //     created_at INTEGER NOT NULL,
  //     attempts  INTEGER NOT NULL DEFAULT 0
  //   );`,
  //   `CREATE INDEX IF NOT EXISTS idx_pending_vn ON ulist_pending (vn_id);`,
  // ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const statements = MIGRATIONS[version];
    if (!statements) continue;
    await db.withTransactionAsync(async () => {
      for (const sql of statements) {
        await db.execAsync(sql);
      }
    });
  }

  if (current !== MIGRATIONS.length) {
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length};`);
  }
  return db;
}

/** 设置页「清除本地数据」用 */
export async function wipeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM ulist;");
    await db.execAsync("DELETE FROM ulist_label;");
    await db.execAsync("DELETE FROM account;");
  });
  // 不降 user_version，表结构保留，只清数据
}
