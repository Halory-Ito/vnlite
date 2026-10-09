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
import * as historyDao from "@/lib/db/dao/history";
import * as playSessionDao from "@/lib/db/dao/play-session";
import {
  getDatabase,
  setDatabaseProvider,
  SCHEMA_VERSION,
  type SqlDatabase,
  type SqlRunResult,
} from "@/lib/db/schema";
import {
  dateErrors,
  diffPatch,
  draftFrom,
  isValidDate,
  isVnId,
} from "@/features/ulist/entry-logic";
import {
  byGameType,
  byListLabel,
  byReleaseDecade,
  summarizeCollection,
  topDevelopers,
} from "@/features/stats/stats-logic";
import { filterByLabel, itemHasLabel } from "@/features/ulist/list-filter";
import {
  dateDigitsRangeErrors,
  dateFilterBounds,
  digitsToIso,
  isoToDigits,
  presetDateFilter,
} from "@/features/history/history-constants";
import { formatGameDuration } from "@/features/game-timer/format";
import {
  elapsedMs,
  getGameTimer,
  pauseGameTimer,
  resumeGameTimer,
  sanitizeGameTimer,
  startGameTimer,
  stopGameTimer,
} from "@/features/game-timer/store";
import {
  currentWeekIndex,
  monthSessionCount,
  monthTotalMs,
  summarizeSessions,
  weeklyBuckets,
  weeksOfMonth,
} from "@/features/play-records/play-stats";
import { formatPlayDuration, formatPlayDurationShort } from "@/features/play-records/format";
import type { PlaySession } from "@/lib/db/dao/play-session";
import { imageGate } from "@/hooks/use-preferences";
import { isFreshDailyQuote } from "@/lib/storage/daily-quote";
import { migratePreferences } from "@/lib/storage/preferences";
import { copyPreview, entryCopyText, vnCopyText } from "@/utils/copy-text";
import { formatMonthDay, formatRelativeTime } from "@/utils/format";

let passed = 0;
let failed = 0;

/** 构造一条测试用游玩会话（某天 10:00 开始，持续 ms 毫秒） */
function sessionAt(year: number, month: number, day: number, ms: number): PlaySession {
  const startedAt = new Date(year, month - 1, day, 10, 0, 0, 0).getTime();
  return { id: ms, vnId: "v1", startedAt, endedAt: startedAt + ms, durationMs: ms };
}

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

  await check("剧透保护：老数据没这一项 → 默认关闭；脏值回退为 false", () => {
    // 攻略模块上线前的老用户：存储里根本没有这个键，默认必须是「关」
    // （默认开会让人一进攻略页签看到满屏圆点，且没有任何提示为什么）
    assert(migratePreferences({}).spoilerShield === false, "老数据应默认关闭剧透保护");
    assert(migratePreferences({ pageSize: 50 }).spoilerShield === false, "缺省应补 false");
    // 严格 true 才算开：手改存储存成 "true" / 1 之类一律按关处理
    assert(migratePreferences({ spoilerShield: true }).spoilerShield === true, "true 应保留");
    assert(
      migratePreferences({ spoilerShield: "true" }).spoilerShield === false,
      "字符串 'true' 不应被当成开启"
    );
    assert(migratePreferences({ spoilerShield: 1 }).spoilerShield === false, "1 不应被当成开启");
  });

  await check("清单标签本地筛选：filterByLabel（切标签不再重新请求）", () => {
    const items = [
      makeItem("v1", { labels: [{ id: 1, label: "Playing" }] }),
      makeItem("v2", {
        labels: [
          { id: 2, label: "Finished" },
          { id: 1, label: "Playing" },
        ],
      }),
      makeItem("v3", { labels: [] }),
      // labels 字段整个缺失（老数据 / 虚拟标签）也要安全
      makeItem("v4"),
    ];

    // 全量 = 原样返回，但必须是**副本**（别把缓存里的数组直接交出去）
    const all = filterByLabel(items, null);
    assert(all.length === 4, `全量应有 4 条，实际 ${all.length}`);
    assert(all !== items, "全量应返回副本，不是原数组");
    assert(all[0] === items[0], "全量应保持原有顺序与元素");

    const playing = filterByLabel(items, 1);
    assert(playing.length === 2, `Playing 应有 2 条，实际 ${playing.length}`);
    assert(
      playing.every((item) => itemHasLabel(item, 1)),
      "筛出来的条目都必须真的带这个标签"
    );
    assert(playing[0]?.id === "v1" && playing[1]?.id === "v2", "筛选应保持原有顺序");

    // 一个标签都没有的条目不该命中任何筛选
    assert(!itemHasLabel(items[2] as UListItem, 1), "空 labels 不该命中");
    assert(!itemHasLabel(items[3] as UListItem, 1), "缺 labels 字段不该命中");
    assert(filterByLabel(items, 99).length === 0, "不存在的标签应筛出 0 条");
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

  await check("formatRelativeTime：刚刚 / 分钟 / 小时 / 天 / 日期", () => {
    const now = Date.now();
    assert(formatRelativeTime(now) === "刚刚", "刚发生应为刚刚");
    assert(formatRelativeTime(now - 5 * 60_000) === "5 分钟前", "5 分钟前");
    assert(formatRelativeTime(now - 3 * 60 * 60_000) === "3 小时前", "3 小时前");
    assert(formatRelativeTime(now - 2 * 24 * 60 * 60_000) === "2 天前", "2 天前");
    // 超过 30 天退回具体日期
    assert(
      formatRelativeTime(now - 40 * 24 * 60 * 60_000)?.includes("-") === true,
      "40 天前应是日期"
    );
    assert(formatRelativeTime(0) === null, "0 应为 null");
    assert(formatRelativeTime(null) === null, "null 应为 null");
    assert(formatRelativeTime(now + 1000) === null, "未来时间应为 null");
  });

  /* ---- 7. 长按复制的文本拼装（纯逻辑） ---- */
  section("7. 长按复制的文本拼装");

  await check("vnCopyText：名字 + (id) + 官网链接，且去掉首尾空白", () => {
    assert(
      vnCopyText({ id: "v2002", title: "  Steins;Gate  " }) ===
        "Steins;Gate (v2002)\nhttps://vndb.org/v2002",
      "作品应带 id 与链接"
    );
    // VNDB 的名字 / id 偶尔带空白，不 trim 的话粘出去会多出空格
    assert(vnCopyText({ id: " v17 ", title: "CLANNAD" }).startsWith("CLANNAD (v17)"), "空白应清掉");
    // 没有标题时别复制出「 (v17)」这种前面带空行的东西
    assert(vnCopyText({ id: "v17", title: "" }) === "(v17)\nhttps://vndb.org/v17", "缺标题应兜底");
    assert(vnCopyText({ id: "", title: "CLANNAD" }) === "CLANNAD", "没有 id 就只给名字");
    assert(vnCopyText({ id: "", title: "" }) === "", "什么都没有应为空串（复制手势变空操作）");
  });

  await check("entryCopyText：角色 / 制作者 / staff / 标签同形状，缺项不留空壳", () => {
    assert(
      entryCopyText("Saber Alter", "c7") === "Saber Alter (c7)\nhttps://vndb.org/c7",
      "角色应拼出官网链接"
    );
    assert(entryCopyText("  Key  ", "") === "Key", "没有 id 就只给名字");
    assert(entryCopyText("", "p24") === "(p24)\nhttps://vndb.org/p24", "缺名字应兜底成 id + 链接");
    assert(entryCopyText("", "") === "", "什么都没有应为空串（复制手势变空操作）");
  });

  await check("copyPreview：换行压成空格、超长截断", () => {
    assert(copyPreview("あ　い\nう") === "あ い う", "连续空白应压成空格");
    assert(copyPreview("短句", 10) === "短句", "没超长就不截");
    const long = copyPreview("ねぇ、かなしい未来", 5);
    assert(long === "ねぇ、かな…", `超长应截断，实际「${long}」`);
  });

  /* ---- 8. 浏览历史 DAO ---- */
  section("8. 浏览历史 DAO");

  await check("recordView / getHistoryPage / getHistoryCount 往返", async () => {
    await historyDao.recordView("vn", "v1", "CLANNAD", "クラナド", "https://t.vndb.org/cv1.jpg");
    await new Promise((r) => setTimeout(r, 1));
    await historyDao.recordView("vn", "v2", "Steins;Gate", null, null);
    await new Promise((r) => setTimeout(r, 1));
    await historyDao.recordView("character", "c1", "Saber", "セイバー", null);

    const page = await historyDao.getHistoryPage(["vn"], 0, 10);
    assert(page.length === 2, `应有 2 条 VN 历史，实际 ${page.length}`);
    assert(page[0]?.entryId === "v2", "应按浏览时间倒序");
    assert(page[0]?.title === "Steins;Gate", "标题不对");
    assert(page[0]?.subtitle === null, "subtitle 应为 null");
    assert(page[0]?.imageUrl === null, "imageUrl 应为 null");

    const count = await historyDao.getHistoryCount(["vn"]);
    assert(count === 2, `VN 历史应有 2 条，实际 ${count}`);

    const charCount = await historyDao.getHistoryCount(["character"]);
    assert(charCount === 1, `角色历史应有 1 条，实际 ${charCount}`);
  });

  await check("「人员」档聚合 角色 + 制作人员", async () => {
    await historyDao.recordView("staff", "s1", "ゆずソフト staff", null, null);
    const people = await historyDao.getHistoryPage(["character", "staff"], 0, 10);
    assert(people.length === 2, `人员档应有 2 条，实际 ${people.length}`);
    const peopleCount = await historyDao.getHistoryCount(["character", "staff"]);
    assert(peopleCount === 2, `人员档计数应为 2，实际 ${peopleCount}`);
    // 空类型集合短路，不该抛错
    assert((await historyDao.getHistoryCount([])) === 0, "空集合计数应为 0");
    assert((await historyDao.getHistoryPage([], 0, 10)).length === 0, "空集合应为空数组");
  });

  await check("recordView 去重：同一条目再次浏览更新 viewed_at", async () => {
    await historyDao.recordView("vn", "v1", "CLANNAD", "クラナド", null);
    // 等 1ms 确保时间戳不同
    await new Promise((r) => setTimeout(r, 1));
    await historyDao.recordView("vn", "v1", "CLANNAD", "クラナド", null);

    const count = await historyDao.getHistoryCount(["vn"]);
    assert(count === 2, `去重后仍应有 2 条，实际 ${count}`);

    const page = await historyDao.getHistoryPage(["vn"], 0, 10);
    const v1 = page.find((e) => e.entryId === "v1");
    assert(v1?.title === "CLANNAD", "标题应更新");
  });

  await check("getHistoryPage 分页", async () => {
    // 先清空 VN 档
    await historyDao.clearHistory(["vn"]);
    for (let i = 0; i < 5; i++) {
      await historyDao.recordView("vn", `v${i}`, `VN ${i}`, null, null);
      await new Promise((r) => setTimeout(r, 1));
    }
    const page1 = await historyDao.getHistoryPage(["vn"], 0, 3);
    assert(page1.length === 3, `第一页应有 3 条，实际 ${page1.length}`);
    const page2 = await historyDao.getHistoryPage(["vn"], 3, 3);
    assert(page2.length === 2, `第二页应有 2 条，实际 ${page2.length}`);
  });

  await check("deleteHistoryEntry 删除单条", async () => {
    await historyDao.deleteHistoryEntry("vn", "v0");
    const count = await historyDao.getHistoryCount(["vn"]);
    assert(count === 4, `删除后应有 4 条，实际 ${count}`);
  });

  await check("clearHistory 清空全部", async () => {
    await historyDao.clearHistory();
    const count = await historyDao.getHistoryCount(["vn"]);
    assert(count === 0, `清空后应有 0 条，实际 ${count}`);
    const peopleCount = await historyDao.getHistoryCount(["character", "staff"]);
    assert(peopleCount === 0, `清空后人员档也应有 0 条，实际 ${peopleCount}`);
  });

  await check("日期筛选：presetDateFilter 的快捷时间段", () => {
    // 2026-10-07 12:00 本地时间
    const now = new Date(2026, 9, 7, 12, 0, 0, 0);
    const all = presetDateFilter("all", now);
    assert(all.start === "" && all.end === "", "全部应为空");
    const today = presetDateFilter("today", now);
    assert(today.start === "2026-10-07" && today.end === "2026-10-07", "今天应首尾同一天");
    // 近 7 天 = 含今天在内共 7 天
    const week = presetDateFilter("week", now);
    assert(week.start === "2026-10-01" && week.end === "2026-10-07", `近 7 天不对：${week.start}`);
    const month = presetDateFilter("month", now);
    assert(
      month.start === "2026-09-08" && month.end === "2026-10-07",
      `近 30 天不对：${month.start}`
    );
  });

  await check("日期筛选：isoToDigits / digitsToIso 互转", () => {
    assert(isoToDigits("2026-10-07") === "20261007", "ISO 应转成 8 位数字");
    assert(isoToDigits("") === "" && isoToDigits("2026") === "2026", "空 / 残缺原样（去非数字）");
    assert(digitsToIso("20261007") === "2026-10-07", "8 位数字应转成 ISO");
    assert(digitsToIso("2026") === "", "不足 8 位应返回空串");
  });

  await check("日期筛选：dateDigitsRangeErrors 校验位数 / 有效性 / 顺序", () => {
    assert(dateDigitsRangeErrors("", "").start === null, "空值应合法");
    assert(dateDigitsRangeErrors("2026", "").start === "请填满 8 位", "未填满应提示补位");
    assert(dateDigitsRangeErrors("20260231", "").start === "日期无效", "不存在的日期应报无效");
    assert(
      dateDigitsRangeErrors("20260501", "20260401").end === "结束日期早于开始日期",
      "结束早于开始应报错"
    );
    assert(dateDigitsRangeErrors("20260401", "20260501").end === null, "正常顺序应合法");
    assert(dateDigitsRangeErrors("20261007", "").end === null, "只填开始应合法");
  });

  await check("日期筛选：dateFilterBounds 含首尾整天", () => {
    const { since, until } = dateFilterBounds({ start: "2026-10-01", end: "2026-10-07" });
    assert(since === new Date(2026, 9, 1, 0, 0, 0, 0).getTime(), "开始应取当天零点");
    assert(until === new Date(2026, 9, 7, 23, 59, 59, 999).getTime(), "结束应取当天最后一毫秒");
    const open = dateFilterBounds({ start: "", end: "" });
    assert(open.since === null && open.until === null, "空筛选应两端不限");
    assert(dateFilterBounds({ start: "2026-10-01", end: "" }).until === null, "只填开始则结束不限");
  });

  await check("getHistoryPage / getHistoryCount 按日期上下界过滤", async () => {
    await historyDao.clearHistory();
    await historyDao.recordView("vn", "v1", "A", null, null);
    const now = Date.now();
    assert(
      (await historyDao.getHistoryCount(["vn"], { since: now + 60_000 })) === 0,
      "下界在未来应查不到"
    );
    assert(
      (await historyDao.getHistoryCount(["vn"], { until: now - 60_000 })) === 0,
      "上界在过去应查不到"
    );
    assert(
      (await historyDao.getHistoryCount(["vn"], { since: now - 60_000, until: now + 60_000 })) ===
        1,
      "落在区间内应查到"
    );
    assert(
      (await historyDao.getHistoryPage(["vn"], 0, 10, { since: now + 60_000 })).length === 0,
      "分页也应尊重日期上下界"
    );
  });

  /* ---- 游戏计时 ---- */

  await check("play_session DAO：写入 / 查询 / 删除（v5 迁移）", async () => {
    await playSessionDao.clearPlaySessions("v-test");
    await playSessionDao.insertPlaySession({
      vnId: "v-test",
      startedAt: 1000,
      endedAt: 2000,
      durationMs: 1000,
    });
    await playSessionDao.insertPlaySession({
      vnId: "v-test",
      startedAt: 3000,
      endedAt: 5000,
      durationMs: 2000,
    });
    const list = await playSessionDao.getPlaySessions("v-test");
    assert(list.length === 2, `应有 2 条，实际 ${list.length}`);
    assert(list[0]!.startedAt === 3000, "应按开始时间倒序");
    await playSessionDao.deletePlaySession(list[0]!.id);
    assert((await playSessionDao.getPlaySessions("v-test")).length === 1, "删除后应剩 1 条");
    await playSessionDao.clearPlaySessions("v-test");
    assert((await playSessionDao.getPlaySessions("v-test")).length === 0, "清空后应为空");
  });

  await check("游戏计时：formatGameDuration 时:分:秒", () => {
    assert(formatGameDuration(0) === "00:00:00", "0 应显示 00:00:00");
    assert(formatGameDuration(59_999) === "00:00:59", "不满 1 分钟进位到秒");
    assert(formatGameDuration(60_000) === "00:01:00", "1 分钟应是 00:01:00");
    assert(formatGameDuration(3_600_000) === "01:00:00", "1 小时应是 01:00:00");
    assert(formatGameDuration(3_599_000) === "00:59:59", "59 分 59 秒");
    assert(formatGameDuration(90 * 3_600_000) === "90:00:00", "小时不封顶");
    assert(formatGameDuration(-1000) === "00:00:00", "负数按 0 处理");
  });

  await check("游戏计时：start / pause / resume / stop 状态流转", () => {
    // 先确保空闲
    stopGameTimer();
    assert(getGameTimer().status === "idle", "初始应为空闲");

    startGameTimer("v1", "CLANNAD");
    const started = getGameTimer();
    assert(started.status === "running", "开始后应为运行中");
    assert(started.vnId === "v1" && started.vnTitle === "CLANNAD", "应记住作品");
    assert(started.accumulatedMs === 0 && started.segmentStartedAt != null, "段起点应就绪");
    assert(started.sessionStartedAt === started.segmentStartedAt, "会话起点应与段起点一致");
    // 运行中：耗时随时间增长（注入固定的 now）
    assert(elapsedMs(started, started.segmentStartedAt! + 5_000) === 5_000, "运行 5 秒应计 5 秒");

    pauseGameTimer();
    const paused = getGameTimer();
    assert(paused.status === "paused" && paused.segmentStartedAt === null, "暂停后段起点应清空");
    const frozen = paused.accumulatedMs;
    assert(frozen >= 0 && frozen < 3_000, `暂停应冻结到一个合理值，实际 ${frozen}`);
    assert(elapsedMs(paused, frozen + 999_999) === frozen, "暂停后耗时不再增长");
    assert(paused.sessionStartedAt === started.sessionStartedAt, "暂停不应改会话起点");

    resumeGameTimer();
    const resumed = getGameTimer();
    assert(resumed.status === "running" && resumed.segmentStartedAt != null, "继续后应重新计时段");
    assert(resumed.accumulatedMs === frozen, "继续应保留之前累计");
    assert(
      elapsedMs(resumed, resumed.segmentStartedAt! + 1_000) === frozen + 1_000,
      "继续后接着计"
    );

    const finished = stopGameTimer();
    assert(getGameTimer().status === "idle", "结束后应回到空闲");
    assert(finished != null, "结束应返回成果");
    assert(finished!.vnId === "v1" && finished!.durationMs >= frozen, "成果应带作品与实际时长");

    // 空操作不应抛错 / 改变状态
    pauseGameTimer();
    resumeGameTimer();
    assert(stopGameTimer() === null, "空档位结束应返回 null");

    // 持久化脏数据兜底
    assert(sanitizeGameTimer(null).status === "idle", "null 应回空闲");
    assert(
      sanitizeGameTimer({ ...started, status: "running", segmentStartedAt: null }).status ===
        "paused",
      "running 无段起点应降级为暂停"
    );
    assert(sanitizeGameTimer({ ...started, vnId: "" }).status === "idle", "空 vnId 应回空闲");
  });

  await check("游玩记录：formatPlayDuration / Short", () => {
    assert(formatPlayDuration(30_000) === "30 秒", "不足 1 分钟显示秒");
    assert(formatPlayDuration(60_000) === "1 分钟", "整分钟");
    assert(formatPlayDuration(45 * 60_000) === "45 分钟", "45 分钟");
    assert(formatPlayDuration(3_600_000) === "1 小时", "整小时");
    assert(formatPlayDuration(5_040_000) === "1 小时 24 分", "1 小时 24 分");
    assert(formatPlayDurationShort(30_000) === "1 m", "不足 1 分钟按 1 分钟");
    assert(formatPlayDurationShort(90 * 60_000) === "1.5 h", "1.5 小时");
    assert(formatPlayDurationShort(20 * 3_600_000) === "20 h", "超过 10 小时取整");
  });

  await check("游玩记录：summarizeSessions 聚合", () => {
    const sessions: PlaySession[] = [
      { id: 1, vnId: "v1", startedAt: 1000, endedAt: 2000, durationMs: 60 * 60_000 },
      { id: 2, vnId: "v1", startedAt: 3000, endedAt: 4000, durationMs: 30 * 60_000 },
    ];
    const stats = summarizeSessions(sessions);
    assert(stats.count === 2, "应统计 2 次");
    assert(stats.totalMs === 90 * 60_000, "总时长应为 90 分钟");
    assert(stats.averageMs === 45 * 60_000, "平均每次 45 分钟");
    assert(stats.longestMs === 60 * 60_000, "最长一次 60 分钟");
    assert(stats.lastPlayedAt === 3000, "最近一次取最大 startedAt");
    assert(summarizeSessions([]).count === 0, "空记录应全 0");
  });

  await check("游玩记录：weeklyBuckets 按周次聚合 + monthTotalMs", () => {
    // 2026-10：1-7 第1周、8-14 第2周…
    const sessions = [
      sessionAt(2026, 10, 3, 1_800_000), // 第1周 30 分
      sessionAt(2026, 10, 9, 3_600_000), // 第2周 60 分
      sessionAt(2026, 10, 10, 3_600_000), // 第2周 60 分
      sessionAt(2026, 9, 20, 9_999_999), // 其它月，不计入
    ];
    const buckets = weeklyBuckets(sessions, 2026, 9); // 10 月 → monthIndex 9
    assert(buckets.length === 5, "31 天的月应有 5 周");
    assert(buckets[0]!.ms === 1_800_000, "第1周应为 30 分");
    assert(buckets[1]!.ms === 7_200_000, "第2周应为 120 分");
    assert(buckets[2]!.ms === 0 && buckets[4]!.ms === 0, "无数据周应为 0");
    assert(buckets[0]!.range === "1-7" && buckets[4]!.range === "29-31", "日期范围按实际月长");
    assert(monthTotalMs(sessions, 2026, 9) === 9_000_000, "本月合计 150 分");
    assert(monthTotalMs(sessions, 2026, 8) === 9_999_999, "上月只含 9 月那条");
  });

  await check("游玩记录：weeksOfMonth 随月长变化 + currentWeekIndex + 月计数", () => {
    assert(weeksOfMonth(2026, 1).length === 4, "2 月 28 天只有 4 周");
    assert(weeksOfMonth(2026, 9).length === 5, "10 月 31 天有 5 周");
    const feb = weeksOfMonth(2026, 1);
    assert(feb[3]!.start === 22 && feb[3]!.end === 28, "最后一档收到月末");
    const now = new Date(2026, 9, 9, 12, 0, 0, 0); // 2026-10-09 → 8-14 这一档
    assert(currentWeekIndex(2026, 9, now) === 1, "今天应命中第 2 周");
    assert(currentWeekIndex(2026, 8, now) === -1, "选中的不是当前月应无高亮");
    const sessions = [sessionAt(2026, 10, 3, 60_000), sessionAt(2026, 10, 9, 60_000)];
    assert(monthSessionCount(sessions, 2026, 9) === 2, "本月应计 2 次");
    assert(monthSessionCount(sessions, 2026, 8) === 0, "上月应为 0");
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
