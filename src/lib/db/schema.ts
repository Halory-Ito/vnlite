/**
 * SQLite 初始化与迁移。
 *
 * ⚠️ 按 2026-09-30 的架构调整：**清单与业务数据一律不落本地库**，
 * 每次从 vndb.org 现拉现读。本地只保留 `account`（用户 id / 用户名 / 权限），
 * 供冷启动先渲染账号信息用。
 */

/** expo-sqlite `SQLiteDatabase` 的结构子集（DAO 只用到这些方法） */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  runAsync(sql: string, ...params: unknown[]): Promise<SqlRunResult>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

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

  // v2 —— 持久化写队列（杀进程不丢）
  [
    `CREATE TABLE IF NOT EXISTS ulist_pending (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      target     TEXT NOT NULL,             -- 'ulist' | 'rlist'
      target_id  TEXT NOT NULL,             -- vn_id 或 release_id
      op         TEXT NOT NULL,             -- 'patch' | 'delete'
      patch      TEXT NOT NULL,             -- JSON（delete 时为 '{}'）
      created_at INTEGER NOT NULL,          -- unix 毫秒
      updated_at INTEGER NOT NULL,          -- unix 毫秒，合并时自增，供竞态保护
      attempts   INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_target ON ulist_pending (target, target_id);`,
  ],

  // v3 —— 清单改为 VNDB 直读直写（不落本地库），镜像表与写队列全部废弃
  [
    `DROP TABLE IF EXISTS ulist;`,
    `DROP TABLE IF EXISTS ulist_label;`,
    `DROP TABLE IF EXISTS ulist_pending;`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

type DatabaseProvider = () => Promise<SqlDatabase>;

let dbPromise: Promise<SqlDatabase> | null = null;
let provider: DatabaseProvider | null = null;

/**
 * 注入 DB 实现（冒烟测试用）。
 * 传 `null` 恢复默认的 expo-sqlite。
 */
export function setDatabaseProvider(next: DatabaseProvider | null): void {
  provider = next;
  dbPromise = null;
}

export function getDatabase(): Promise<SqlDatabase> {
  if (!dbPromise) {
    dbPromise = provider ? provider().then(migrate) : openDefault().then(migrate);
  }
  return dbPromise;
}

async function openDefault(): Promise<SqlDatabase> {
  // 懒加载：expo-sqlite 是原生模块，顶层 import 会让 bun 冒烟直接崩
  const SQLite = await import("expo-sqlite");
  return SQLite.openDatabaseAsync(DB_NAME);
}

async function migrate(db: SqlDatabase): Promise<SqlDatabase> {
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

/**
 * 设置页「清除本地数据」用。
 *
 * 现在本地只剩 account 一张表（清单数据不落库，见 v3 迁移）。
 */
export async function wipeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM account;");
  });
  // 不降 user_version，表结构保留，只清数据
}
