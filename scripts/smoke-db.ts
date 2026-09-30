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

import type { Producer, UListItem } from "@/lib/api/types";
import * as accountDao from "@/lib/db/dao/account";
import {
  getDatabase,
  setDatabaseProvider,
  SCHEMA_VERSION,
  type SqlDatabase,
  type SqlRunResult,
} from "@/lib/db/schema";
import { dateErrors, diffPatch, draftFrom, isValidDate, isVnId } from "@/features/ulist/entryLogic";
import {
  byGameType,
  byListLabel,
  byReleaseDecade,
  summarizeCollection,
  topDevelopers,
} from "@/features/stats/statsLogic";
import { imageGate } from "@/hooks/usePreferences";
import { isFreshDailyQuote } from "@/lib/storage/dailyQuote";
import { migratePreferences } from "@/lib/storage/preferences";
import { formatMonthDay } from "@/utils/format";

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

/** 厂商字段的最小形状（统计聚合只读 id / name） */
const dev = (id: string, name: string): Producer => ({ id, name });

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

  await check("vnViewMode：默认网格、list 保留、脏值回退、旧键接过来", () => {
    assert(migratePreferences({}).vnViewMode === "grid", "老数据没这一项应回默认网格");
    assert(migratePreferences({ vnViewMode: "list" }).vnViewMode === "list", "list 应保留");
    assert(migratePreferences({ vnViewMode: "squares" }).vnViewMode === "grid", "脏值应回退到网格");
    // 2026-09-30 从 ulistViewMode 改名成 vnViewMode，旧键的值要接过来
    assert(
      migratePreferences({ ulistViewMode: "list" }).vnViewMode === "list",
      "旧键 ulistViewMode 的值应迁移过来"
    );
    assert(migratePreferences({ pageSize: 50 }).pageSize === 50, "其他字段不应被迁移改掉");
  });

  await check("browseSort：默认人气降序、合法值保留、脏值回退", () => {
    const def = migratePreferences({}).browseSort;
    assert(def.field === "votecount" && def.reverse === true, "默认应为人气降序");
    const kept = migratePreferences({
      browseSort: { field: "released", reverse: false },
    }).browseSort;
    assert(kept.field === "released" && kept.reverse === false, "合法值应保留");
    assert(
      migratePreferences({ browseSort: { field: "wat", reverse: true } }).browseSort.field ===
        "votecount",
      "脏字段应回退到人气"
    );
    assert(
      migratePreferences({ listSort: { field: "added", reverse: true } }).browseSort.field ===
        "votecount",
      "废弃的 listSort 不应影响浏览排序"
    );
  });

  await check("imageGate：缺字段按露骨处理，三档行为正确", () => {
    assert(imageGate("hide", { sexual: 2 }).hidden, "hide + 露骨应隐藏");
    assert(!imageGate("hide", { sexual: 0, violence: 0 }).hidden, "hide + 安全不应隐藏");
    assert(imageGate("blur", { violence: 2 }).blurred, "blur + 露骨应模糊");
    assert(!imageGate("blur", { sexual: 1, violence: 0 }).blurred, "暗示级不模糊（只模糊露骨）");
    assert(!imageGate("show", { sexual: 2 }).blurred, "show 档不模糊");
    assert(imageGate("blur", {}).level === 2, "缺字段应按露骨处理（最保守）");
  });

  /* ---- 5. 收藏统计（纯逻辑） ---- */
  section("5. 收藏统计聚合（纯逻辑）");

  await check("byReleaseDecade：十年一档、只保留有数据的年代、升序", () => {
    const items = [
      makeItem("v1", { vn: { id: "v1", title: "A", released: "2010-05-01" } }),
      makeItem("v2", { vn: { id: "v2", title: "B", released: "2005" } }),
      makeItem("v3", { vn: { id: "v3", title: "C", released: "2010-11-20" } }),
      makeItem("v4", { vn: { id: "v4", title: "D", released: "1999-12-31" } }),
      // 未定档 / 缺字段的都不进统计
      makeItem("v5", { vn: { id: "v5", title: "E", released: "TBA" } }),
      makeItem("v6"),
    ];
    const buckets = byReleaseDecade(items);
    assert(buckets.length === 3, `应有 3 个年代，实际 ${buckets.length}`);
    assert(buckets[0]?.label === "1990-1999", "最早应是 1990-1999");
    assert(buckets[1]?.label === "2000-2009" && buckets[1].count === 1, "2000-2009 应 1 部");
    assert(buckets[2]?.label === "2010-2019" && buckets[2].count === 2, "2010-2019 应 2 部");
  });

  await check("byGameType：只认固定类型清单、计数降序", () => {
    const items = [
      makeItem("v1", { vn: { id: "v1", title: "A", tags: [{ id: "g32" }, { id: "g104" }] } }),
      makeItem("v2", { vn: { id: "v2", title: "B", tags: [{ id: "g32" }, { id: "g43" }] } }),
      // 非类型标签（Comedy / 不存在的 id）都不该进统计
      makeItem("v3", { vn: { id: "v3", title: "C", tags: [{ id: "g9999" }] } }),
      makeItem("v4"),
    ];
    const buckets = byGameType(items);
    assert(buckets.length === 2, `只应统计类型标签，实际 ${buckets.length}`);
    assert(buckets[0]?.name === "ADV" && buckets[0].count === 2, "ADV 应居首且计 2");
    assert(buckets[1]?.name === "NVL" && buckets[1].count === 1, "NVL 次之");
  });

  await check("byListLabel：虚拟标签不计、按计数降序", () => {
    const labels = [
      { id: 1, label: "Playing" },
      { id: 2, label: "Finished" },
      { id: 13, label: "Waiting" },
    ];
    const items = [
      makeItem("v1", {
        labels: [
          { id: 2, label: "Finished" },
          { id: 7, label: "Voted" },
        ],
      }),
      makeItem("v2", {
        labels: [
          { id: 2, label: "Finished" },
          { id: 13, label: "Waiting" },
        ],
      }),
      makeItem("v3", { labels: [{ id: 0, label: "No label" }] }),
      makeItem("v4"),
    ];
    const buckets = byListLabel(items, labels);
    assert(buckets.length === 2, `0 / 7 不该出现，实际 ${buckets.length}`);
    assert(buckets[0]?.name === "Finished" && buckets[0].count === 2, "Finished 应居首");
    assert(buckets[1]?.name === "Waiting", "自建标签名应取 /ulist_labels 里的原名");
  });

  await check("topDevelopers：多厂商各记一次、Top N 截断", () => {
    const items = [
      makeItem("v1", {
        vn: { id: "v1", title: "A", developers: [dev("p1", "Key"), dev("p2", "X")] },
      }),
      makeItem("v2", { vn: { id: "v2", title: "B", developers: [dev("p1", "Key")] } }),
      makeItem("v3", { vn: { id: "v3", title: "C", developers: [dev("p3", "Y")] } }),
      makeItem("v4"),
    ];
    const top = topDevelopers(items, 2);
    assert(top.length === 2, "Top 2 应只留两条");
    assert(top[0]?.id === "p1" && top[0].count === 2, "Key 应居首且计 2");
    assert(topDevelopers(items, 8).length === 3, "不截断时应有三家");
  });

  await check("summarizeCollection：总数 / 已通关 / 均分", () => {
    const items = [
      makeItem("v1", { vote: 80, labels: [{ id: 2, label: "Finished" }] }),
      makeItem("v2", { vote: 100 }),
      makeItem("v3"),
    ];
    const summary = summarizeCollection(items);
    assert(summary.total === 3, "总数不对");
    assert(summary.voted === 2, "打分数不对");
    assert(summary.finished === 1, "已通关数不对");
    assert(summary.averageVote === 90, `均分应为 90，实际 ${summary.averageVote}`);
    assert(summarizeCollection([]).averageVote === null, "没打分应为 null");
  });

  /* ---- 6. 每日语录（纯逻辑） ---- */
  section("6. 每日语录缓存 / 日期文案");

  await check("isFreshDailyQuote：只有当天才算新鲜", () => {
    assert(isFreshDailyQuote({ date: "2026-09-30" }, "2026-09-30"), "同一天应新鲜");
    assert(!isFreshDailyQuote({ date: "2026-09-29" }, "2026-09-30"), "昨天应过期");
    assert(!isFreshDailyQuote(null, "2026-09-30"), "没有缓存应过期");
  });

  await check("formatMonthDay：`2026-09-30` → `9 月 30 日`", () => {
    assert(formatMonthDay("2026-09-30") === "9 月 30 日", "月份不应补零");
    assert(formatMonthDay("2026-12-01") === "12 月 1 日", "日期不应补零");
    assert(formatMonthDay("坏数据") === "坏数据", "解析不了时原样返回");
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
