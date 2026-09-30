/**
 * 冒烟测试：在 bun 里跑真实的迁移 + account DAO + 清单编辑页纯逻辑 + 偏好迁移 / NSFW 门禁。
 *
 *   bun run scripts/smoke-db.ts
 *
 * bun 下没有原生模块（expo-sqlite），所以用 `setDatabaseProvider` 注入
 * `bun:sqlite` 适配器；生产环境懒加载 expo-sqlite。
 *
 * ⚠️ 2026-09-30 架构调整：清单数据**不再落本地库**（VNDB 直读直写），
 * 迁移 v3 会把旧的 ulist / ulist_label / ulist_pending 全部删掉。
 */

import { Database } from "bun:sqlite";

import type { UListItem } from "@/lib/api/types";
import * as accountDao from "@/lib/db/dao/account";
import {
  getDatabase,
  setDatabaseProvider,
  SCHEMA_VERSION,
  type SqlDatabase,
  type SqlRunResult,
} from "@/lib/db/schema";
import { dateErrors, diffPatch, draftFrom, isValidDate, isVnId } from "@/features/ulist/entryLogic";
import { imageGate } from "@/hooks/usePreferences";
import { migratePreferences } from "@/lib/storage/preferences";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  \u2717 ${name}\n      ${String(error)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/* -------------------------------------------------------------------------- */
/* bun:sqlite → SqlDatabase 适配器                                              */
/* -------------------------------------------------------------------------- */

class BunAdapter implements SqlDatabase {
  constructor(private readonly db: Database) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const row = this.db.query(sql).get(...bind(params));
    return (row ?? null) as T | null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.db.query(sql).all(...bind(params)) as T[];
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<SqlRunResult> {
    const result = this.db.query(sql).run(...bind(params));
    return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec("BEGIN");
    try {
      await task();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function bind(params: unknown[]): unknown[] {
  return params.map((p) => (p === undefined ? null : p));
}

/* -------------------------------------------------------------------------- */
/* 测试数据                                                                    */
/* -------------------------------------------------------------------------- */

const makeItem = (id: string, extra: Partial<UListItem> = {}): UListItem => ({ id, ...extra });

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log("vnlite 本地库冒烟测试 —— 迁移 / account / 编辑页纯逻辑（bun:sqlite）\n");

  const mainDb = new Database(":memory:");
  setDatabaseProvider(async () => new BunAdapter(mainDb));

  /* ---- 1. 迁移 ---- */
  section("1. SQLite 迁移（v3：清单不落库）");

  await check("迁移跑完，user_version 对上", async () => {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
    assert(
      row?.user_version === SCHEMA_VERSION,
      `应为 ${SCHEMA_VERSION}，实际 ${row?.user_version}`
    );
  });

  await check("account 表存在（本地只剩这一张业务表）", async () => {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'account';"
    );
    assert(row, "account 表不存在");
  });

  await check("清单镜像表不存在（ulist / ulist_label / ulist_pending）", async () => {
    const db = await getDatabase();
    for (const name of ["ulist", "ulist_label", "ulist_pending"]) {
      const row = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;",
        name
      );
      assert(!row, `${name} 不应存在（清单不落本地库）`);
    }
  });

  await check("getDatabase 缓存同一连接", async () => {
    assert((await getDatabase()) === (await getDatabase()), "两次调用应返回同一实例");
  });

  await check("从 v2 升级：旧镜像表被删掉，版本推到最新", async () => {
    const legacy = new Database(":memory:");
    // 伪造一个 v2 的库：有旧镜像表 + 旧写队列
    legacy.exec(`
      CREATE TABLE ulist (vn_id TEXT PRIMARY KEY NOT NULL, vn TEXT NOT NULL);
      CREATE TABLE ulist_label (id INTEGER PRIMARY KEY NOT NULL, label TEXT NOT NULL);
      CREATE TABLE ulist_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL);
      PRAGMA user_version = 2;
    `);
    setDatabaseProvider(async () => new BunAdapter(legacy));
    try {
      const db = await getDatabase();
      for (const name of ["ulist", "ulist_label", "ulist_pending"]) {
        const row = await db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;",
          name
        );
        assert(!row, `升级后 ${name} 应被删除`);
      }
      const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
      assert(version?.user_version === SCHEMA_VERSION, "升级后 user_version 应为最新");
    } finally {
      setDatabaseProvider(async () => new BunAdapter(mainDb));
    }
  });

  /* ---- 2. account DAO ---- */
  section("2. account DAO");

  await check("upsertAccount / getAccount 往返", async () => {
    await accountDao.upsertAccount({
      userId: "u12345",
      username: "测试用户",
      permissions: ["listread", "listwrite"],
      loggedInAt: 1000,
    });
    const account = await accountDao.getAccount();
    assert(account?.userId === "u12345", `userId 不对：${account?.userId}`);
    assert(account?.permissions.join(",") === "listread,listwrite", "permissions 应还原");
  });

  await check("markSynced 打时间戳", async () => {
    assert((await accountDao.getAccountSyncedAt()) === null, "初始应为 null");
    await accountDao.markSynced();
    assert((await accountDao.getAccountSyncedAt()) !== null, "标记后应有时间戳");
  });

  await check("clearAccount 清空", async () => {
    await accountDao.clearAccount();
    assert((await accountDao.getAccount()) === null, "应清空");
  });

  /* ---- 3. 清单编辑页纯逻辑 ---- */
  section("3. 清单编辑页纯逻辑（draft / diff / 日期）");

  await check("draftFrom：labels 取 id、null 字段变空串", () => {
    const entry = makeItem("v1", {
      vote: 88,
      labels: [{ id: 1, label: "Playing" }],
      notes: null,
      started: null,
      finished: null,
    });
    const draft = draftFrom(entry);
    assert(draft.vote === 88, "vote 不对");
    assert(draft.labels.join(",") === "1", "labels 应取 id");
    assert(draft.notes === "" && draft.started === "" && draft.finished === "", "空值应转空串");
  });

  await check("diffPatch：只提交变化字段，没变返回 null", () => {
    const entry = makeItem("v1", { vote: 80, notes: "旧备注", started: "2024-01-01" });
    const draft = { ...draftFrom(entry), vote: 90, notes: "  新备注  " };
    const patch = diffPatch(entry, draft);
    assert(patch?.vote === 90, "vote 应进 patch");
    assert(patch?.notes === "新备注", "备注应 trim 后进 patch");
    assert(patch && !("started" in patch), "没改的日期不该进 patch");
    assert(diffPatch(entry, draftFrom(entry)) === null, "没变化应返回 null");
  });

  await check("diffPatch：清空备注 / 日期用 null 表达", () => {
    const entry = makeItem("v1", { notes: "旧", finished: "2024-02-02" });
    const patch = diffPatch(entry, { ...draftFrom(entry), notes: "", finished: "" });
    assert(patch?.notes === null && patch?.finished === null, "清空应写 null");
  });

  await check("日期校验：格式与真实日期", () => {
    assert(isValidDate("2024-01-05"), "合法日期应通过");
    assert(!isValidDate("2024-1-5"), "缺零应被拒");
    assert(!isValidDate("2023-02-31"), "不存在的日期应被拒");
    assert(!isValidDate("2024/01/05"), "斜杠格式应被拒");
    const errs = dateErrors("2024-05-01", "2024-04-01");
    assert(errs.finished === "完成日期早于开始日期", `错误文案不对：${errs.finished}`);
  });

  await check("isVnId：路由参数只认 v+数字（挡住 /ulist/undefined）", () => {
    assert(isVnId("v17") && isVnId("v58641"), "合法 vndbid 应通过");
    assert(!isVnId("c23"), "非 VN 前缀应被拒");
    assert(!isVnId("v17x"), "尾部杂字符应被拒");
    assert(!isVnId(""), "空串应被拒");
    assert(!isVnId("undefined"), "脏参数应被拒");
  });

  /* ---- 4. 偏好（迁移 / NSFW 门禁） ---- */
  section("4. 偏好（迁移 / NSFW 门禁）");

  await check("ulistViewMode：默认网格、list 保留、脏值回退", () => {
    assert(migratePreferences({}).ulistViewMode === "grid", "老数据没这一项应回默认网格");
    assert(migratePreferences({ ulistViewMode: "list" }).ulistViewMode === "list", "list 应保留");
    assert(
      migratePreferences({ ulistViewMode: "squares" }).ulistViewMode === "grid",
      "脏值应回退到网格"
    );
    assert(migratePreferences({ pageSize: 50 }).pageSize === 50, "其他字段不应被迁移改掉");
  });

  await check("imageGate：缺字段按露骨处理，三档行为正确", () => {
    assert(imageGate("hide", { sexual: 2 }).hidden, "hide + 露骨应隐藏");
    assert(!imageGate("hide", { sexual: 0, violence: 0 }).hidden, "hide + 安全不应隐藏");
    assert(imageGate("blur", { violence: 2 }).blurred, "blur + 露骨应模糊");
    assert(!imageGate("blur", { sexual: 1, violence: 0 }).blurred, "暗示级不模糊（只模糊露骨）");
    assert(!imageGate("show", { sexual: 2 }).blurred, "show 档不模糊");
    assert(imageGate("blur", {}).level === 2, "缺字段应按露骨处理（最保守）");
  });

  /* ---- 结果 ---- */
  console.log(`\n${"=".repeat(60)}`);
  console.log(`通过 ${passed} / 失败 ${failed}`);
  console.log(`${"=".repeat(60)}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("冒烟脚本自身出错：", error);
  process.exit(1);
});
