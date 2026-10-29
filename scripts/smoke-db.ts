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
import * as favoriteDao from "@/lib/db/dao/favorite";
import * as historyDao from "@/lib/db/dao/history";
import * as playSessionDao from "@/lib/db/dao/play-session";
import {
  getDatabase,
  setDatabaseProvider,
  SCHEMA_VERSION,
  type SqlDatabase,
  type SqlRunResult,
} from "@/lib/db/schema";
import { diffPatch, draftFrom, isVnId } from "@/features/ulist/lib/entry-logic";
import {
  byGameType,
  byListLabel,
  byReleaseDecade,
  summarizeCollection,
  topDevelopers,
} from "@/features/stats/lib/stats-logic";
import { filterByLabel, itemHasLabel } from "@/features/ulist/lib/list-filter";
import { dateFilterBounds, presetDateFilter } from "@/features/history/lib/history-constants";
import { formatGameDuration } from "@/features/game-timer/lib/format";
import {
  elapsedMs,
  getGameTimer,
  pauseGameTimer,
  resumeGameTimer,
  sanitizeGameTimer,
  startGameTimer,
  stopGameTimer,
} from "@/features/game-timer/lib/store";
import {
  currentWeekIndex,
  monthSessionCount,
  monthTotalMs,
  summarizeSessions,
  weeklyBuckets,
  weeksOfMonth,
} from "@/features/play-records/lib/play-stats";
import { formatPlayDuration, formatPlayDurationShort } from "@/features/play-records/lib/format";
import {
  domainOf,
  kungalLogoUrl,
  lookupKungalLogo,
  lookupKungalLogoByName,
  normalizeCompanyName,
  officialWebsiteOf,
} from "@/features/catalog/lib/kungal-logo";
import {
  dateTimeFieldError,
  durationBetween,
  formatLocalDate,
  formatLocalTime,
  sessionRangeError,
  toLocalTimestamp,
} from "@/features/play-records/lib/session-time";
import { parseVnReviews } from "@/features/review/lib/scrape";
import { excludeIds, pickSimilarTags } from "@/features/recommend/lib/recommend";
import {
  addMonths,
  clampMonth,
  daysInMonth,
  groupByDay,
  monthKey,
  monthRange,
  monthsAfterMonth,
  monthsBeforeMonth,
} from "@/features/calendar/lib/calendar";
import {
  GETCHU_AWARDS,
  GETCHU_DEPT_ORDER,
  getchuEntriesFor,
  getchuYears,
  MOE_AWARDS,
  MOE_PRIZE_ORDER,
  moeEntriesFor,
  moeYears,
} from "@/features/awards/lib/awards";
import {
  getTagName,
  getTagNames,
  loadTagNames,
  recordTagNames,
} from "@/features/browse/lib/tag-names";
import { compileVnFilters } from "@/lib/api/filters";
import {
  addPoolTags,
  getTagPoolState,
  loadTagPool,
  mergeTagPool,
  removePoolTags,
} from "@/features/ranking/lib/tag-pool";
import { toTagEntries } from "@/features/search/lib/search-logic";
import {
  backlogSummary,
  completionSummary,
  statusBuckets,
  voteBuckets,
  voteComparison,
} from "@/features/stats/lib/list-analysis";
import { isNewerVersion, parseVersion } from "@/features/settings/lib/update-check";
import { base64Encode, basicAuthValue } from "@/features/sync/lib/base64";
import { buildBackup, parseBackup } from "@/features/sync/lib/backup";
import { applyBackupData, collectBackupData } from "@/features/sync/lib/package";
import {
  getAvatar,
  getBackup,
  joinUrl,
  normalizeServerUrl,
  putBackup,
} from "@/features/sync/lib/providers/webdav/client";
import type { SyncConfig } from "@/features/sync/lib/configs/types";
import {
  parseConfig,
  readActiveId,
  readConfigs,
  writeActiveId,
  writeConfigs,
} from "@/features/sync/lib/configs/storage";
import { secretKey } from "@/features/sync/lib/configs/secret-key";
import {
  getProvider,
  isProviderReady,
  SYNC_PROVIDERS,
} from "@/features/sync/lib/providers/registry";
import type { ProviderContext, SyncSecretStore } from "@/features/sync/lib/providers/types";
import { ONEDRIVE_PROVIDER } from "@/features/sync/lib/providers/onedrive/provider";
import { ONEDRIVE_ENDPOINTS } from "@/features/sync/lib/providers/onedrive/endpoints";
import {
  getAvatar as getOneDriveAvatar,
  getBackup as getOneDriveBackup,
  putBackup as putOneDriveBackup,
} from "@/features/sync/lib/providers/onedrive/client";
import { readMarks, writeMarks } from "@/features/walkthrough/lib/marks";
import { registerStore } from "@/lib/storage/key-value";
import { diffCatalogKeys, flattenCatalog } from "@/lib/i18n/catalog-utils";
import { en } from "@/lib/i18n/catalogs/en";
import { zh } from "@/lib/i18n/catalogs/zh";
import { resolveLocale, setDeviceLocale, setLocale, t } from "@/lib/i18n/translate";
import {
  monthlyPlayBuckets,
  playtimeByGameType,
  playtimeByVn,
  recentWeekBuckets,
  weekStartMs,
} from "@/features/stats/lib/play-stats-logic";
import type { PlaySession } from "@/lib/db/dao/play-session";
import { imageGate } from "@/hooks/use-preferences";
import { isFreshDailyQuote } from "@/lib/storage/daily-quote";
import { migratePreferences } from "@/lib/storage/preferences";
import { copyPreview, entryCopyText, vnCopyText } from "@/utils/copy-text";
import {
  dateRangeErrors,
  digitsToIso,
  digitsToPartialIso,
  isoToDigits,
  isValidDate,
} from "@/utils/date";
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

/**
 * bun 特有的全局（项目 tsconfig 没装 `@types/bun`，这里手写最小声明）。
 *
 * 只用到一个能力：起一个本地 HTTP 服务器当「假 WebDAV」。
 */
declare const Bun: {
  serve(options: { port: number; fetch: (request: Request) => Response | Promise<Response> }): {
    port: number;
    stop: (closeActiveConnections?: boolean) => void;
  };
};

/**
 * bun 里没有 AsyncStorage 的原生实现 —— 注入一个**内存版** KV。
 *
 * 同步功能要打包「攻略标记」（`features/walkthrough/marks`），标记存在 KV 里，
 * 没有这层替代的话那段逻辑在冒烟里跑不起来。
 */
const memoryStore = new Map<string, string>();

registerStore({
  get: async <T>(key: string): Promise<T | null> => {
    const raw = memoryStore.get(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set: async <T>(key: string, value: T): Promise<void> => {
    memoryStore.set(key, JSON.stringify(value));
  },
  remove: async (key: string): Promise<void> => {
    memoryStore.delete(key);
  },
  getOr: async <T>(key: string, fallback: T): Promise<T> => {
    const raw = memoryStore.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  clear: async (): Promise<void> => {
    memoryStore.clear();
  },
  keys: async (): Promise<string[]> => [...memoryStore.keys()],
});

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
    const errs = dateRangeErrors("2024-05-01", "2024-04-01");
    assert(errs.end === "dateField.rangeOrder", `错误键不对：${errs.end}`);
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

  await check("背景位置：缺省居中、越界夹取、脏值回居中", () => {
    const def = migratePreferences({}).backgroundPosition;
    assert(def.x === 0.5 && def.y === 0.5, "老数据应默认居中");
    const kept = migratePreferences({ backgroundPosition: { x: 0.2, y: 0.9 } }).backgroundPosition;
    assert(kept.x === 0.2 && kept.y === 0.9, "合法值应保留");
    const clamped = migratePreferences({ backgroundPosition: { x: -3, y: 8 } }).backgroundPosition;
    assert(clamped.x === 0 && clamped.y === 1, "越界应夹到 0–1");
    const dirty = migratePreferences({
      backgroundPosition: { x: "左", y: null },
    }).backgroundPosition;
    assert(dirty.x === 0.5 && dirty.y === 0.5, "非数字应回居中");
  });

  await check("自定义主题：缺省配色、非法色值回默认、三位简写不动", () => {
    const def = migratePreferences({}).customTheme;
    assert(def.primary === "#6EC8D2" && def.secondary === "#F0AA64", "老数据应补默认配色");
    const kept = migratePreferences({
      customTheme: { primary: "#123ABC", secondary: "#fff" },
    }).customTheme;
    assert(kept.primary === "#123ABC", "合法六位应保留（大小写不强制处理）");
    assert(kept.secondary === "#fff", "合法三位应保留");
    const dirty = migratePreferences({
      customTheme: { primary: "red", secondary: 42 },
    }).customTheme;
    assert(dirty.primary === "#6EC8D2", "非法主色应回默认");
    assert(dirty.secondary === "#F0AA64", "非法辅色应回默认");
  });

  await check("卡片透明度：缺省 0.72、合法保留、越界夹取、脏值回默认", () => {
    assert(migratePreferences({}).cardOpacity === 0.72, "老数据应补默认 0.72");
    assert(migratePreferences({ cardOpacity: 0.4 }).cardOpacity === 0.4, "合法值应保留");
    assert(migratePreferences({ cardOpacity: 2 }).cardOpacity === 1, "超过 1 应夹到 1");
    assert(migratePreferences({ cardOpacity: -1 }).cardOpacity === 0, "负值应夹到 0");
    assert(migratePreferences({ cardOpacity: "半透明" }).cardOpacity === 0.72, "非数字回默认");
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

  /* ---- 4b. 国际化（i18n） ---- */

  await check("界面语言偏好：默认跟随系统、合法值保留、脏值回退", () => {
    assert(migratePreferences({}).language === "system", "老数据应默认跟随系统");
    assert(migratePreferences({ language: "en" }).language === "en", "en 应保留");
    assert(migratePreferences({ language: "zh" }).language === "zh", "zh 应保留");
    assert(migratePreferences({ language: "fr" }).language === "system", "不支持的值应回退");
    assert(migratePreferences({ language: 1 }).language === "system", "非字符串应回退");
  });

  await check("翻译目录：zh / en 键集合完全一致", () => {
    const diff = diffCatalogKeys(zh, en);
    assert(diff.missing.length === 0, `en 缺键：${diff.missing.join(", ")}`);
    assert(diff.extra.length === 0, `en 多键：${diff.extra.join(", ")}`);
    assert(flattenCatalog(zh).length >= 100, "键数过少，目录可能没挂上");
  });

  await check("翻译运行时：插值 / 语言切换 / 设备语言解析", () => {
    setLocale("zh");
    assert(t("tabs.home") === "首页", `zh 应返回中文，实际 ${t("tabs.home")}`);
    assert(t("format.monthsAgo", { months: 3 }) === "3 个月前", "插值应生效");

    setLocale("en");
    assert(t("tabs.home") === "Home", `en 应返回英文，实际 ${t("tabs.home")}`);
    assert(t("format.minutesAgo", { minutes: 5 }) === "5 min ago", "英文插值应生效");

    setDeviceLocale("en");
    assert(resolveLocale("system") === "en", "system 应跟随设备语言");
    assert(resolveLocale("zh") === "zh", "显式 zh 应优先于设备语言");
    setDeviceLocale("zh");
    setLocale("zh");
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
    assert(digitsToPartialIso("2026") === "2026", "部分数字应原样保留");
    assert(digitsToPartialIso("20260") === "2026-0", "第 5 位起补第一个分隔符");
    assert(digitsToPartialIso("20261007") === "2026-10-07", "填满应等价于 digitsToIso");
  });

  await check("日期筛选：dateRangeErrors 校验位数 / 有效性 / 顺序", () => {
    assert(dateRangeErrors("", "").start === null, "空值应合法");
    assert(dateRangeErrors("2026", "").start === "dateField.incomplete", "未填满应提示补位");
    assert(dateRangeErrors("2026-02-31", "").start === "dateField.invalid", "不存在的日期应报无效");
    assert(
      dateRangeErrors("2026-05-01", "2026-04-01").end === "dateField.rangeOrder",
      "结束早于开始应报错"
    );
    assert(dateRangeErrors("2026-04-01", "2026-05-01").end === null, "正常顺序应合法");
    assert(dateRangeErrors("2026-10-07", "").end === null, "只填开始应合法");
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

  /* ---- 收藏 DAO（v6） ---- */

  await check("addFavorite / isFavorite / getFavoritesPage / getFavoriteCount 往返", async () => {
    await favoriteDao.addFavorite("vn", "v1", "CLANNAD", "クラナド", "https://t.vndb.org/cv1.jpg");
    await favoriteDao.addFavorite("vn", "v2", "Steins;Gate", null, null);
    await favoriteDao.addFavorite("character", "c1", "Saber", "セイバー", null);

    assert(await favoriteDao.isFavorite("vn", "v1"), "v1 应已收藏");
    assert(!(await favoriteDao.isFavorite("vn", "v9")), "未收藏的应返回 false");

    const page = await favoriteDao.getFavoritesPage(["vn"], 0, 10);
    assert(page.length === 2, `应有 2 条作品收藏，实际 ${page.length}`);
    assert(page[0]?.entryId === "v2", "应按收藏时间倒序");
    assert(page[1]?.imageUrl === "https://t.vndb.org/cv1.jpg", "封面应还原");

    assert((await favoriteDao.getFavoriteCount(["vn"])) === 2, "作品档计数应为 2");
    assert((await favoriteDao.getFavoriteCount(["character", "staff"])) === 1, "人员档计数应为 1");
    assert((await favoriteDao.getFavoriteCount([])) === 0, "空集合计数应为 0");
    assert((await favoriteDao.getFavoritesPage([], 0, 10)).length === 0, "空集合应为空数组");
  });

  await check("重复收藏保留首次时间、只刷新元数据", async () => {
    const before = (await favoriteDao.getFavoritesPage(["vn"], 0, 10)).find(
      (e) => e.entryId === "v1"
    );
    await new Promise((r) => setTimeout(r, 5));
    await favoriteDao.addFavorite("vn", "v1", "CLANNAD 改名", "クラナド", null);
    const after = (await favoriteDao.getFavoritesPage(["vn"], 0, 10)).find(
      (e) => e.entryId === "v1"
    );
    assert(after?.title === "CLANNAD 改名", "标题应更新");
    assert(after?.favoritedAt === before?.favoritedAt, "favorited_at 不应被覆盖");
    assert((await favoriteDao.getFavoriteCount(["vn"])) === 2, "重复收藏不该多出一条");
  });

  await check("removeFavorite / clearFavorites", async () => {
    await favoriteDao.removeFavorite("vn", "v1");
    assert(!(await favoriteDao.isFavorite("vn", "v1")), "删除后应不再收藏");
    assert((await favoriteDao.getFavoriteCount(["vn"])) === 1, "删除后作品档应剩 1 条");

    await favoriteDao.clearFavorites(["character"]);
    assert((await favoriteDao.getFavoriteCount(["character", "staff"])) === 0, "按类型清空");
    assert((await favoriteDao.getFavoriteCount(["vn"])) === 1, "不应误删其它类型");

    await favoriteDao.clearFavorites();
    assert((await favoriteDao.getFavoriteCount(["vn"])) === 0, "全量清空后应为 0");
  });

  /* ---- 记录统计 · 游玩聚合（纯逻辑） ---- */

  await check("playtimeByVn：按作品累计时长、降序", () => {
    const sessions: PlaySession[] = [
      { id: 1, vnId: "v1", startedAt: 1, endedAt: 2, durationMs: 3_600_000 },
      { id: 2, vnId: "v2", startedAt: 3, endedAt: 4, durationMs: 1_800_000 },
      { id: 3, vnId: "v1", startedAt: 5, endedAt: 6, durationMs: 900_000 },
    ];
    const ranking = playtimeByVn(sessions);
    assert(ranking.length === 2, `应有 2 部作品，实际 ${ranking.length}`);
    assert(ranking[0]!.vnId === "v1" && ranking[0]!.ms === 4_500_000, "v1 应累计 450 万毫秒");
    assert(ranking[1]!.vnId === "v2" && ranking[1]!.ms === 1_800_000, "v2 次之");
    assert(playtimeByVn([]).length === 0, "空记录应为空数组");
  });

  await check("playtimeByGameType：只认类型标签、按时长降序", () => {
    const sessions: PlaySession[] = [
      { id: 1, vnId: "v1", startedAt: 1, endedAt: 2, durationMs: 3_600_000 },
      { id: 2, vnId: "v2", startedAt: 3, endedAt: 4, durationMs: 1_800_000 },
    ];
    // v1 = ADV + RPG，v2 = ADV；v3 没玩过
    const typesByVn = new Map<string, readonly string[]>([
      ["v1", ["g32", "g35", "g9999"]],
      ["v2", ["g32"]],
      ["v3", ["g43"]],
    ]);
    const buckets = playtimeByGameType(sessions, typesByVn);
    assert(buckets.length === 2, `非类型标签不该进统计，实际 ${buckets.length}`);
    assert(buckets[0]!.id === "g32" && buckets[0]!.ms === 5_400_000, "ADV 应累计 540 万毫秒");
    assert(buckets[1]!.id === "g35" && buckets[1]!.ms === 3_600_000, "RPG 次之");
    assert(
      buckets.every((b) => b.name !== "g9999"),
      "未知 id 不该出现"
    );
  });

  await check("monthlyPlayBuckets：近 12 个月、含当月、空月补 0", () => {
    const now = new Date(2026, 9, 10, 12); // 2026-10-10
    const sessions: PlaySession[] = [
      {
        id: 1,
        vnId: "v1",
        startedAt: new Date(2026, 9, 5, 10).getTime(),
        endedAt: new Date(2026, 9, 5, 11).getTime(),
        durationMs: 3_600_000,
      },
      {
        id: 2,
        vnId: "v1",
        startedAt: new Date(2026, 8, 20, 10).getTime(),
        endedAt: new Date(2026, 8, 20, 10, 30).getTime(),
        durationMs: 1_800_000,
      },
      // 窗口之外的更早记录不计
      {
        id: 3,
        vnId: "v1",
        startedAt: new Date(2025, 0, 1, 10).getTime(),
        endedAt: new Date(2025, 0, 1, 12).getTime(),
        durationMs: 9_999_999,
      },
    ];
    const buckets = monthlyPlayBuckets(sessions, 12, now);
    assert(buckets.length === 12, `应 12 个月，实际 ${buckets.length}`);
    assert(buckets[0]!.year === 2025 && buckets[0]!.month === 10, "第一个应是 2025-11");
    assert(buckets[11]!.year === 2026 && buckets[11]!.month === 9, "最后应是 2026-10");
    assert(buckets[11]!.ms === 3_600_000, "10 月应为 60 分钟");
    assert(buckets[10]!.ms === 1_800_000, "9 月应为 30 分钟");
    assert(buckets[0]!.ms === 0, "窗口外 / 空月应为 0");
  });

  await check("recentWeekBuckets：近 8 周、周一为起点、含时长与次数", () => {
    const now = new Date(2026, 9, 10, 12); // 2026-10-10
    const thisWeek = weekStartMs(now) + 3 * 3_600_000;
    const lastWeek = new Date(2026, 9, 3, 12).getTime();
    const sessions: PlaySession[] = [
      { id: 1, vnId: "v1", startedAt: thisWeek, endedAt: thisWeek + 1, durationMs: 3_600_000 },
      { id: 2, vnId: "v1", startedAt: thisWeek, endedAt: thisWeek + 1, durationMs: 600_000 },
      { id: 3, vnId: "v2", startedAt: lastWeek, endedAt: lastWeek + 1, durationMs: 1_800_000 },
    ];
    const buckets = recentWeekBuckets(sessions, 8, now);
    assert(buckets.length === 8, `应 8 周，实际 ${buckets.length}`);
    assert(buckets[7]!.startAt === weekStartMs(now), "最后一档应是本周一");
    assert(buckets[7]!.ms === 4_200_000 && buckets[7]!.count === 2, "本周应 2 次共 70 分钟");
    assert(buckets[6]!.ms === 1_800_000 && buckets[6]!.count === 1, "上周应 1 次 30 分钟");
    assert(
      buckets.slice(0, 6).every((b) => b.ms === 0 && b.count === 0),
      "更早的空周应为 0"
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

  await check("检查更新：parseVersion / isNewerVersion", () => {
    assert(parseVersion("v1.2.1")?.patch === 1, "v 前缀应可解析");
    assert(parseVersion("1.2")?.minor === 2 && parseVersion("1.2")?.patch === 0, "缺段补 0");
    assert(parseVersion("1.2.1-beta.2")?.patch === 1, "带后缀只取前三段");
    assert(parseVersion("abc") === null && parseVersion("") === null, "非法输入返回 null");

    assert(isNewerVersion("1.2.1", "1.2.0") === true, "补丁位更大算更新");
    assert(isNewerVersion("v1.2.0", "1.2.0") === false, "v 前缀不影响相等判断");
    assert(isNewerVersion("1.3.0", "1.2.9") === true, "次版本优先于补丁位");
    assert(isNewerVersion("2.0.0", "1.9.9") === true, "主版本优先");
    assert(isNewerVersion("1.2.0", "1.2.1") === false, "更旧不算更新");
    assert(isNewerVersion("bad", "1.0.0") === false, "无法解析时保守返回 false");
  });

  await check("游玩记录编辑：时间解析 / 校验 / 时长", () => {
    const ts = toLocalTimestamp("2026-10-10", "14:30");
    assert(ts === new Date(2026, 9, 10, 14, 30, 0, 0).getTime(), "日期+时间应解析为本地时间戳");
    assert(toLocalTimestamp("2026-02-30", "10:00") === null, "不存在的日期应返回 null");
    assert(toLocalTimestamp("2026-10-10", "25:00") === null, "非法时间应返回 null");

    assert(dateTimeFieldError("2026-10-10", "09:05") === null, "合法输入无错误");
    assert(dateTimeFieldError("2026-2-3", "09:05") !== null, "日期格式不对应报错");
    assert(dateTimeFieldError("2026-10-10", "9:5") !== null, "时间格式不对应报错");

    assert(sessionRangeError(1000, 2000) === null, "结束晚于开始应合法");
    assert(sessionRangeError(2000, 1000) !== null, "结束早于开始应报错");
    assert(durationBetween(1000, 4000) === 3000, "时长应为差值");
    assert(durationBetween(4000, 1000) === 0, "逆序时长按 0");

    assert(formatLocalDate(ts!) === "2026-10-10", "格式化日期");
    assert(formatLocalTime(ts!) === "14:30", "格式化时间");
  });

  await check("厂商 LOGO：域名解析 / 官网选择 / 鲲 Galgame 索引查表", () => {
    assert(domainOf("http://www.guilty-soft.com/") === "guilty-soft.com", "去协议 / www");
    assert(domainOf("https://stage-nana.sakura.ne.jp") === "stage-nana.sakura.ne.jp", "保留子域");
    assert(domainOf("not a url") === null, "非法 URL 返回 null");

    const producer = {
      id: "p115",
      name: "Guilty",
      original: "ギルティ",
      extlinks: [
        { label: "Official website", name: "", url: "http://www.guilty-soft.com/" },
        { label: "Wikipedia (ja)", name: "", url: "https://ja.wikipedia.org/wiki/Guilty" },
      ],
    };
    assert(
      officialWebsiteOf(producer) === "http://www.guilty-soft.com/",
      "优先取 Official website"
    );

    // 归一化：大小写 / 空白 / 标点 / 全角 / 株式会社后缀都要抹平
    assert(normalizeCompanyName("  Alice Soft ") === "alicesoft", "空白与大小写应归一");
    assert(normalizeCompanyName("ＡＬＩＣＥＳＯＦＴ") === "alicesoft", "全角应归一");
    assert(normalizeCompanyName("株式会社アリスソフト") === "アリスソフト", "日文公司后缀应去掉");
    assert(normalizeCompanyName("Key, Inc.") === "key", "英文公司后缀应去掉");
    assert(normalizeCompanyName("") === "" && normalizeCompanyName(null) === "", "空值应安全");

    // LOGO 文件名（64 位 hex）→ 图床 URL
    const hash = "e8".repeat(32);
    assert(
      kungalLogoUrl(hash) === `https://image.kungal.iloveren.link/e8/e8/${hash}.webp`,
      "应由文件名拼出图床 URL"
    );

    // 域名优先：同一家公司域名命中时不看名字
    const index = {
      generatedAt: "2026-10-10",
      source: "https://www.kungal.com/galgame/official",
      domains: { "guilty-soft.com": hash },
      names: { [normalizeCompanyName("Guilty")]: "ab".repeat(32) },
    };
    assert(lookupKungalLogo(index, producer) === kungalLogoUrl(hash), "域名命中应优先于名字");

    // 名字兜底：VNDB 的 name / original 都试（原名常是日文）
    const byName = {
      ...index,
      domains: {},
      names: { [normalizeCompanyName("ギルティ")]: hash },
    };
    assert(
      lookupKungalLogo(byName, producer) === kungalLogoUrl(hash),
      "域名缺失时应按 original 命中"
    );

    // 都不中 → null（调用方不画图）
    assert(
      lookupKungalLogo({ ...index, domains: {}, names: {} }, producer) === null,
      "未命中应为 null"
    );

    // extlinks 为空 → 退回名称匹配
    assert(
      lookupKungalLogo(byName, { ...producer, extlinks: undefined }) === kungalLogoUrl(hash),
      "没有 extlinks 时应按名称命中"
    );

    // 只按名称查表（历史 / 收藏的兜底路径：条目里只有名称）
    assert(
      lookupKungalLogoByName(index, ["Guilty", null]) === kungalLogoUrl("ab".repeat(32)),
      "按名称查表应命中 name"
    );
    assert(
      lookupKungalLogoByName(index, [null, "ギルティ（不存在）"]) === null,
      "按名称未命中应为 null"
    );
  });

  /* ---- 同步（WebDAV 备份） ---- */
  await section("同步：备份包 / base64 / WebDAV 客户端");

  await check("base64 编码：补位与 UTF-8", () => {
    assert(base64Encode("") === "", "空串应为空");
    assert(base64Encode("a") === "YQ==", "单字节要补两个 =");
    assert(base64Encode("ab") === "YWI=", "两字节要补一个 =");
    assert(base64Encode("abc") === "YWJj", "三字节不补位");
    assert(base64Encode("user:pass") === "dXNlcjpwYXNz", "Basic 认证的已知向量不对");
    assert(base64Encode("中") === "5Lit", "中文要按 UTF-8 编码");
    assert(basicAuthValue("u", "p") === "Basic dTpw", "认证头格式不对");
  });

  await check("服务器地址校正与 URL 拼接", () => {
    assert(
      normalizeServerUrl("https://dav.example.com/dav/") === "https://dav.example.com/dav",
      "末尾斜杠要去掉"
    );
    assert(
      normalizeServerUrl("  http://192.168.1.2:8080/dav  ") === "http://192.168.1.2:8080/dav",
      "首尾空格要去掉"
    );
    assert(normalizeServerUrl("dav.example.com") === null, "没有协议应判非法");
    assert(normalizeServerUrl("ftp://dav.example.com") === null, "非 http(s) 应判非法");
    assert(normalizeServerUrl("") === null, "空串应判非法");
    assert(
      joinUrl("https://dav.example.com/dav", "vnlite-backup.json") ===
        "https://dav.example.com/dav/vnlite-backup.json",
      "拼接结果不对"
    );
  });

  await check("备份包解析：合法包还原，脏数据丢条目", () => {
    const payload = buildBackup(
      {
        history: [
          {
            id: 1,
            type: "vn",
            entryId: "v1",
            title: "CLANNAD",
            subtitle: null,
            imageUrl: null,
            viewedAt: 10,
          },
        ],
        favorite: [],
        playSession: [],
        preferences: { themeId: "air" },
        marks: { v1: { endings: [], steps: {} } },
      },
      1234
    );
    const parsed = parseBackup(JSON.parse(JSON.stringify(payload)) as unknown);
    assert(parsed !== null, "自己打的包应能解析回来");
    assert(parsed?.data.history.length === 1, "历史条数不对");
    assert(parsed?.data.history[0]?.entryId === "v1", "条目 id 不对");
    assert(parsed?.createdAt === 1234, "打包时间不对");

    // 不是 vnlite 的包 → null
    assert(parseBackup({ app: "other", format: 1, data: {} }) === null, "别的应用的包应判非法");
    assert(parseBackup(null) === null, "null 应判非法");
    assert(parseBackup("nonsense") === null, "字符串应判非法");

    // 半截条目整条丢掉
    const dirty = parseBackup({
      app: "vnlite",
      format: 1,
      createdAt: 1,
      data: {
        history: [
          { type: "vn", entryId: "v1", title: "好的" },
          { type: "vn", entryId: "v2" },
          { type: "???", entryId: "v3", title: "类型不对" },
        ],
      },
    });
    assert(dirty?.data.history.length === 1, "只该留下完整的那一条");
  });

  await check("备份往返：打包 → 恢复（整体替换）", async () => {
    await historyDao.recordView("vn", "v10", "CLANNAD");
    await favoriteDao.addFavorite("vn", "v10", "CLANNAD");
    await playSessionDao.insertPlaySession({
      vnId: "v10",
      startedAt: 1_000,
      endedAt: 2_000,
      durationMs: 1_000,
    });
    await writeMarks({ vid: "v10", endings: ["e1"], steps: { s1: { done: true } }, updatedAt: 1 });

    const data = await collectBackupData();
    assert(
      data.history.some((e) => e.entryId === "v10"),
      "应打包进历史"
    );
    assert(
      data.favorite.some((e) => e.entryId === "v10"),
      "应打包进收藏"
    );
    assert(
      data.playSession.some((s) => s.vnId === "v10"),
      "应打包进游玩记录"
    );
    assert(Object.keys(data.marks).includes("v10"), "攻略标记也要打包（它是用户数据不是缓存）");

    // 只恢复一条历史 → 本地其余历史应被清掉（整体替换，不是合并）
    await applyBackupData({ ...data, history: data.history.slice(0, 1) });
    const after = await historyDao.getAllHistory();
    assert(after.length === 1, `恢复应是整体替换，实际 ${after.length} 条`);

    // 恢复后收藏 / 游玩记录 / 标记都还在
    assert(
      (await favoriteDao.getAllFavorites()).some((e) => e.entryId === "v10"),
      "收藏应恢复"
    );
    assert(
      (await playSessionDao.getAllPlaySessions()).some((s) => s.vnId === "v10"),
      "游玩记录应恢复"
    );
    const marks = await readMarks("v10");
    assert(marks.endings.includes("e1"), "攻略标记应恢复");
  });

  await check("WebDAV 客户端：建目录 / PUT 上传 / GET 下载 / 老备份回退", async () => {
    const files = new Map<string, string>();
    let auth: string | null = null;
    const madeDirs: string[] = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        auth = request.headers.get("Authorization");
        if (request.method === "MKCOL") {
          madeDirs.push(url.pathname);
          return new Response(null, { status: 201 });
        }
        if (request.method === "PUT") {
          files.set(url.pathname, await request.text());
          return new Response(null, { status: 201 });
        }
        if (request.method === "GET") {
          const body = files.get(url.pathname);
          if (body === undefined) return new Response("not found", { status: 404 });
          return new Response(body, {
            headers: {
              "Content-Length": String(body.length),
              "Last-Modified": new Date(1_700_000_000_000).toUTCString(),
            },
          });
        }
        return new Response("method not allowed", { status: 405 });
      },
    });

    try {
      const config = {
        url: `http://127.0.0.1:${server.port}/dav`,
        username: "u",
        password: "p",
      };
      await putBackup(config, JSON.stringify({ hello: "world" }));
      assert(auth === "Basic dTpw", `认证头不对：${auth}`);
      assert(madeDirs.includes("/dav/vnlite"), `应先建 vnlite 目录，实际：${madeDirs.join(", ")}`);
      assert(
        files.has("/dav/vnlite/vnlite-backup.json"),
        `备份应写进 vnlite 目录，实际：${[...files.keys()].join(", ")}`
      );

      const result = await getBackup(config);
      assert(result !== null, "应能下载回来");
      assert(
        (JSON.parse(result?.body ?? "{}") as { hello?: string }).hello === "world",
        "内容应一致"
      );
      assert((result?.info.size ?? 0) > 0, "大小应大于 0");
      assert(result?.info.modifiedAt === 1_700_000_000_000, "应解析出 Last-Modified");

      // 老版本存在同级目录的备份 → 也能读到（不能因为换目录就把旧备份弄丢）
      files.set("/dav/vnlite-backup.json", JSON.stringify({ hello: "legacy" }));
      files.delete("/dav/vnlite/vnlite-backup.json");
      const legacy = await getBackup(config);
      assert(
        (JSON.parse(legacy?.body ?? "{}") as { hello?: string }).hello === "legacy",
        "应回退到老位置的备份"
      );

      // 服务器上没有那个文件 → null（不是抛错）
      const missing = await getBackup({ ...config, url: `http://127.0.0.1:${server.port}/empty` });
      assert(missing === null, "没有文件时应返回 null");
    } finally {
      server.stop(true);
    }
  });

  await check("WebDAV 头像：GET 拿字节 / 没有文件返回 null", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01]);
    let auth: string | null = null;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        auth = request.headers.get("Authorization");
        const path = new URL(request.url).pathname;
        // 只有 /dav/vnlite-avatar.jpg 存在，其余一律 404
        if (path === "/dav/vnlite-avatar.jpg") return new Response(bytes);
        return new Response(null, { status: 404 });
      },
    });

    try {
      const config = {
        url: `http://127.0.0.1:${server.port}/dav`,
        username: "u",
        password: "p",
      };
      const downloaded = await getAvatar(config);
      assert(downloaded !== null, "应能下载头像");
      assert(downloaded.length === bytes.length, "字节数应一致");
      assert(downloaded[0] === 0xff && downloaded[4] === 0x01, "内容应一致");
      assert(auth === "Basic dTpw", `认证头不对：${auth}`);

      const missing = await getAvatar({
        ...config,
        url: `http://127.0.0.1:${server.port}/empty`,
      });
      assert(missing === null, "服务器没有头像时应返回 null");
    } finally {
      server.stop(true);
    }
  });

  await check("多份配置：写入 / 读取 / 当前配置 / 坏数据丢掉", async () => {
    const configs: SyncConfig[] = [
      {
        id: "c1",
        name: "坚果云",
        provider: "webdav",
        options: { url: "https://dav.example.com/dav", username: "u" },
        lastSyncAt: null,
        createdAt: 1,
      },
      {
        id: "c2",
        name: "OneDrive",
        provider: "onedrive",
        options: { clientId: "app", accountEmail: "a@b.c" },
        lastSyncAt: 222,
        createdAt: 2,
      },
    ];
    await writeConfigs(configs);
    const list = await readConfigs();
    assert(list.length === 2, `应读到 2 份配置，实际 ${list.length}`);
    assert(list[1]?.lastSyncAt === 222, "上次同步时间应保留");
    assert(list[0]?.options.url === "https://dav.example.com/dav", "选项应原样保留");

    await writeActiveId("c2");
    assert((await readActiveId()) === "c2", "当前配置 id 应记住");

    // 坏数据：供应商不认识 → 整条丢掉（别的配置不受影响）
    const broken = {
      id: "x",
      name: "坏",
      provider: "unknown",
      options: {},
      lastSyncAt: null,
      createdAt: 0,
    } as unknown as SyncConfig;
    await writeConfigs([...configs, broken]);
    const dirty = await readConfigs();
    assert(dirty.length === 2, `坏配置应被丢掉，实际 ${dirty.length}`);
    assert(parseConfig(broken) === null, "不认识的服务应判非法");
    assert(parseConfig({ id: "no-provider" }) === null, "没有服务的配置应判非法");
  });

  await check("供应商：清单 / 校验", async () => {
    assert(SYNC_PROVIDERS.length === 4, "选择列表应有 4 个服务");
    assert(isProviderReady("webdav") && isProviderReady("onedrive"), "WebDAV / OneDrive 已实现");
    assert(!isProviderReady("googledrive") && !isProviderReady("quark"), "另两家还没实现");
    assert(getProvider("googledrive") === null, "没实现的供应商拿不到实现");

    const webdav = getProvider("webdav");
    const bad = webdav?.validate({ url: "ftp://x" });
    assert(bad !== undefined && !bad.ok, "地址不对应校验失败");
    const good = webdav?.validate({ url: " https://dav.example.com/dav/ ", username: " u " });
    assert(good?.ok === true, "合法地址应通过");
    assert(
      good?.ok && good.options.url === "https://dav.example.com/dav",
      "地址应被规范化（去末尾斜杠）"
    );
    assert(good?.ok && good.options.username === "u", "用户名应去掉空白");

    const oneDrive = getProvider("onedrive");
    const notConnected = oneDrive?.validate({ clientId: "app" });
    assert(notConnected !== undefined && !notConnected.ok, "没连账号应校验失败");
    const connected = oneDrive?.validate({
      clientId: "app",
      accountEmail: "a@b.c",
      accountName: "A",
    });
    assert(connected?.ok === true, "连上账号后应通过");
    assert(
      oneDrive?.validate({ clientId: "  ", accountEmail: "a@b.c" }).ok === false,
      "没有应用 ID 应校验失败"
    );
    assert(ONEDRIVE_PROVIDER.meta.id === "onedrive", "OneDrive 供应商 id 应是 onedrive");
  });

  await check("密钥 key：按配置 id 隔离", async () => {
    const a = secretKey("cfg1", "password");
    const b = secretKey("cfg2", "password");
    assert(a !== b, "不同配置的密钥 key 应不同");
    assert(!a.includes("."), "key 不能带点（Android Keystore）");
    assert(a.includes("cfg1"), "key 里应带配置 id");
  });

  await check("OneDrive 客户端：建目录 / PUT 上传 / GET 下载 / 老备份回退", async () => {
    const files = new Map<string, string>();
    let auth: string | null = null;
    let folderCreated = false;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        auth = request.headers.get("Authorization");
        if (url.pathname.endsWith("/token")) {
          return new Response(
            JSON.stringify({ access_token: "tok", refresh_token: "rt", expires_in: 3600 }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        // 查备份目录
        if (url.pathname.endsWith("/root:/vnlite") && request.method === "GET") {
          return folderCreated
            ? new Response(JSON.stringify({ name: "vnlite" }), {
                headers: { "Content-Type": "application/json" },
              })
            : new Response(null, { status: 404 });
        }
        // 建备份目录
        if (url.pathname.endsWith("/root/children") && request.method === "POST") {
          folderCreated = true;
          return new Response(JSON.stringify({ name: "vnlite" }), { status: 201 });
        }
        if (request.method === "PUT") {
          files.set(url.pathname, await request.text());
          return new Response(
            JSON.stringify({
              size: 12,
              lastModifiedDateTime: "2026-10-21T07:30:00.000Z",
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        if (request.method === "GET") {
          const body = files.get(url.pathname);
          if (body === undefined) return new Response(null, { status: 404 });
          return new Response(body, { headers: { "Content-Length": String(body.length) } });
        }
        return new Response(null, { status: 405 });
      },
    });

    const originalGraph = ONEDRIVE_ENDPOINTS.graph;
    const originalLogin = ONEDRIVE_ENDPOINTS.login;
    ONEDRIVE_ENDPOINTS.graph = `http://127.0.0.1:${server.port}/v1.0`;
    ONEDRIVE_ENDPOINTS.login = `http://127.0.0.1:${server.port}/login`;
    const secrets: SyncSecretStore = {
      get: async (key) => (key === "refreshToken" ? "rt" : null),
      set: async () => {},
      remove: async () => {},
    };
    const ctx: ProviderContext = {
      provider: "onedrive",
      configId: "od1",
      options: { clientId: "app" },
      secrets,
    };

    try {
      const info = await putOneDriveBackup(ctx, JSON.stringify({ hello: "world" }));
      assert(auth === "Bearer tok", `认证头不对：${auth}`);
      assert(folderCreated, "应先建 vnlite 目录");
      assert(
        files.has("/v1.0/me/drive/root:/vnlite/vnlite-backup.json:/content"),
        `备份应写进 vnlite 目录，实际：${[...files.keys()].join(", ")}`
      );
      assert(info.size === 12, `大小应取 Graph 返回的，实际 ${info.size}`);
      assert(info.modifiedAt === Date.parse("2026-10-21T07:30:00.000Z"), "应解析出修改时间");

      const result = await getOneDriveBackup(ctx);
      assert(result !== null, "应能下载回来");
      assert(
        (JSON.parse(result?.body ?? "{}") as { hello?: string }).hello === "world",
        "内容应一致"
      );

      // 老版本存在同级目录的备份 → 也能读到
      files.set(
        "/v1.0/me/drive/root:/vnlite-backup.json:/content",
        JSON.stringify({ hello: "legacy" })
      );
      files.delete("/v1.0/me/drive/root:/vnlite/vnlite-backup.json:/content");
      const legacy = await getOneDriveBackup(ctx);
      assert(
        (JSON.parse(legacy?.body ?? "{}") as { hello?: string }).hello === "legacy",
        "应回退到老位置的备份"
      );

      // 云盘上没有那个文件 → null（不是抛错）
      files.clear();
      const missing = await getOneDriveBackup(ctx);
      assert(missing === null, "没有文件时应返回 null");
      const missingAvatar = await getOneDriveAvatar(ctx);
      assert(missingAvatar === null, "没有头像时应返回 null");
    } finally {
      ONEDRIVE_ENDPOINTS.graph = originalGraph;
      ONEDRIVE_ENDPOINTS.login = originalLogin;
      server.stop(true);
    }
  });

  await check("作品评价解析：卡片字段 / Read more 截断 / 坏卡片丢弃", async () => {
    const html = `
      <div class="reviews">
      <article><div><span>Short by <a href="/u154784">succhunter</a> on 2022-04-30</span><span>9/10</span></div><div></div><div><span>&lt;<a href="/report/w4208">report</a>></span>Hello <b>world</b>. <a href="/w4208#review"> Read more &raquo;</a></div><div><a href="/w4208#threadstart">1 comment</a><span><small> 10 points</small></span></div></article>
      <article><div><span>Medium by <a href="/u2">neonblue</a> on 2020-12-28</span><a href="/r60521">r60521</a><span>9.4/10</span></div><div></div><div><span>&lt;<a href="/report/w1240">report</a>></span>Great game.</div><div><a href="/w1240#threadstart">0 comments</a><span><small> 3 points</small></span></div></article>
      <article><div><span>没有 report 链接的坏卡片</span></div></article>
      </div>`;

    const reviews = parseVnReviews(html);
    assert(reviews.length === 2, `应解析出 2 条，实际 ${reviews.length}`);

    const first = reviews[0]!;
    assert(first.id === "w4208", `评价 id 不对：${first.id}`);
    assert(first.author === "succhunter" && first.authorId === "u154784", "作者解析不对");
    assert(first.date === "2022-04-30", `日期不对：${first.date}`);
    assert(first.score === 9 && first.length === "Short", "分数 / 篇幅不对");
    assert(first.excerpt === "Hello world.", `摘要应在 Read more 处截断：${first.excerpt}`);
    assert(first.points === 10 && first.comments === 1, "有用数 / 评论数不对");

    const second = reviews[1]!;
    assert(second.score === 9.4, `小数分应保留：${second.score}`);
    assert(second.length === "Medium", "篇幅不对");
    assert(second.excerpt === "Great game.", `摘要不对：${second.excerpt}`);

    // 不是评价页 → 空数组（不抛）
    assert(parseVnReviews("<html><body>nope</body></html>").length === 0, "非评价页应返回空");
  });

  await check("清单分析：状态 / 评分分布 / backlog / 与社区比", async () => {
    const make = (over: Partial<UListItem>): UListItem =>
      ({ id: "v1", vote: null, labels: [], vn: {}, ...over }) as UListItem;

    const items: UListItem[] = [
      make({
        id: "v1",
        labels: [{ id: 1, label: "Playing" }],
        vn: { id: "v1", title: "", length: 3, rating: 70 },
      }),
      make({
        id: "v2",
        labels: [{ id: 2, label: "Finished" }],
        vote: 80,
        vn: { id: "v2", title: "", length: 2, rating: 70 },
      }),
      make({
        id: "v3",
        labels: [{ id: 2, label: "Finished" }],
        vote: 100,
        vn: { id: "v3", title: "", length: 5, rating: 80 },
      }),
      make({
        id: "v4",
        labels: [{ id: 4, label: "Dropped" }],
        vn: { id: "v4", title: "", length: 1, rating: 60 },
      }),
      make({
        id: "v5",
        labels: [{ id: 5, label: "Wishlist" }],
        vn: { id: "v5", title: "", length: 5, rating: 90 },
      }),
      make({ id: "v6", labels: [{ id: 6, label: "Blacklist" }], vn: { id: "v6", title: "" } }),
    ];

    const statuses = statusBuckets(items);
    assert(statuses.length === 6, "六个状态都要有");
    assert(statuses[0]?.count === 1, "在玩 1 部");
    assert(statuses[1]?.count === 2, "已通关 2 部");
    assert(statuses[5]?.count === 1, "黑名单 1 部");

    const votes = voteBuckets(items);
    assert(votes[7]?.count === 1, "80 分应落在 8 分档");
    assert(votes[9]?.count === 1, "100 分应落在 10 分档");
    assert(votes.reduce((sum, bucket) => sum + bucket.count, 0) === 2, "只有 2 部打了分");

    // 待玩：v1(20h) + v5(60h)；v2/v3 已通关、v4 已抛弃、v6 黑名单都不算
    const backlog = backlogSummary(items);
    assert(backlog.count === 2, `待玩应为 2 部，实际 ${backlog.count}`);
    assert(backlog.hours === 80, `预计时长应为 80 小时，实际 ${backlog.hours}`);
    assert(backlog.known === 2, "两部都填了时长");

    // 只比两边都有分的：v2(8 vs 7) + v3(10 vs 8)
    const comparison = voteComparison(items);
    assert(comparison.count === 2, "应只比较 2 部");
    assert(comparison.mine === 9 && comparison.community === 7.5, "均分不对");
    assert(comparison.delta === 1.5, "差值不对");

    // 完成率：2 已通关 /（6 − 1 黑名单）
    const completion = completionSummary(items);
    assert(completion.rate === 0.4, `完成率不对：${completion.rate}`);
  });

  await check("相似作品：标签挑选 / 去重", async () => {
    const vn = {
      tags: [
        { id: "g19", name: "Mystery", rating: 2.9, spoiler: 0, category: "cont" },
        { id: "g32", name: "ADV", rating: 3, spoiler: 0, category: "tech" },
        { id: "g2", name: "Spoiler tag", rating: 3, spoiler: 2, category: "cont" },
        { id: "g3", name: "Rare tag", rating: 1, spoiler: 0, category: "cont" },
        { id: "g4", name: "Romance", rating: 2.4, spoiler: 0, category: "cont" },
      ],
    };

    const tags = pickSimilarTags(vn);
    assert(tags.length === 2, `只应留下 2 个内容标签，实际 ${tags.length}`);
    assert(tags[0]?.id === "g19" && tags[1]?.id === "g4", "应按认可度降序");
    assert(!tags.some((tag) => tag.id === "g32"), "技术标签（ADV）不应参与");
    assert(!tags.some((tag) => tag.id === "g2"), "剧透标签不应参与");
    assert(!tags.some((tag) => tag.id === "g3"), "冷门标签不应参与");

    const limited = pickSimilarTags(
      {
        tags: Array.from({ length: 10 }, (_, i) => ({
          id: `g${i}`,
          rating: 2.5,
          category: "cont",
        })),
      },
      3
    );
    assert(limited.length === 3, "limit 应生效");

    const filtered = excludeIds([{ id: "v1" }, { id: "v2" }], new Set(["v1"]));
    assert(filtered.length === 1 && filtered[0]?.id === "v2", "本作不应出现在相似列表里");

    assert(pickSimilarTags({}).length === 0, "没有标签时应返回空");
  });

  await check("标签搜索：行数据（id + 作品数）", async () => {
    const entries = toTagEntries([{ results: [{ id: "g19", name: "Mystery", vn_count: 12345 }] }]);
    assert(entries.length === 1, "应有一行");
    assert(entries[0]?.id === "g19" && entries[0]?.title === "Mystery", "标签名 / id 不对");
    assert(entries[0]?.meta?.includes("g19"), "右侧应带标签 id");
    assert(toTagEntries(undefined).length === 0, "没有数据时应返回空");
  });

  await check("发售日历：翻月 / 月份区间 / 按天分组", async () => {
    assert(
      JSON.stringify(addMonths({ year: 2026, month: 12 }, 1)) ===
        JSON.stringify({ year: 2027, month: 1 }),
      "跨年翻月不对"
    );
    assert(
      JSON.stringify(addMonths({ year: 2026, month: 1 }, -1)) ===
        JSON.stringify({ year: 2025, month: 12 }),
      "往前翻月不对"
    );

    assert(monthKey({ year: 2026, month: 3 }) === "2026-03", "月份 key 不对");
    // 2024 年 2 月是闰月
    assert(monthRange({ year: 2024, month: 2 }).to === "2024-02-29", "闰月最后一天应为 29 号");
    assert(monthRange({ year: 2026, month: 1 }).from === "2026-01-01", "月初不对");

    const groups = groupByDay([
      { id: "v1", released: "2026-10-01" },
      { id: "v2", released: "2026-10-01" },
      { id: "v3", released: "2026-10-05" },
      { id: "v4", released: "2026-10" },
      { id: "v5", released: "TBA" },
      { id: "v6", released: null },
    ]);
    assert(groups.length === 2, `应分成 2 天，实际 ${groups.length}`);
    assert(groups[0]?.day === "2026-10-01" && groups[0].items.length === 2, "同一天应合并");
    assert(groups[1]?.day === "2026-10-05", "第二天不对");

    // 月历：闰月天数（库负责格子，这里只守日期区间与夹取）
    assert(daysInMonth({ year: 2024, month: 2 }) === 29, "闰年 2 月应有 29 天");
    assert(
      JSON.stringify(clampMonth({ year: 1200, month: 1 })) ===
        JSON.stringify({ year: 1950, month: 1 }),
      "越界月份应夹到范围起点"
    );
    assert(monthsBeforeMonth({ year: 1950, month: 1 }) === 0, "起点之前不应还有月份");
    assert(monthsAfterMonth({ year: 2100, month: 12 }) === 0, "终点之后不应还有月份");
    assert(
      monthsBeforeMonth({ year: 2026, month: 10 }) === (2026 - 1950) * 12 + 9,
      "pastScrollRange 不对"
    );
  });

  await check("大赏数据：萌えゲーアワード（年份降序 / 层级 / 年代抽查）", async () => {
    assert(MOE_AWARDS.length >= 45, `萌系条目太少：${MOE_AWARDS.length}`);
    const seen = new Set<string>();
    for (const award of MOE_AWARDS) {
      const key = `${award.year}:${award.prize}:${award.title}`;
      assert(!seen.has(key), `萌系行重复：${key}`);
      seen.add(key);
      assert(award.title.length > 0, `${award.year} 缺标题`);
      assert(award.vnId === null || /^v\d+$/.test(award.vnId), `${award.year} vnId 形状`);
    }
    // 年份降序，年内层级大賞 → 準大賞 → 金 → 銀 → 銅
    for (let i = 1; i < MOE_AWARDS.length; i += 1) {
      const prev = MOE_AWARDS[i - 1]!;
      const curr = MOE_AWARDS[i]!;
      assert(
        prev.year > curr.year ||
          (prev.year === curr.year && MOE_PRIZE_ORDER[prev.prize] <= MOE_PRIZE_ORDER[curr.prize]),
        "萌系应按年份降序 + 层级排"
      );
    }
    // 每年都有主线层级；2013 起是大賞/準大賞，2009–2012 金銀銅，2006–2008 單一大賞
    for (const y of moeYears()) {
      const entries = moeEntriesFor(y);
      if (y >= 2013 || y <= 2008) {
        assert(
          entries.some((e) => e.prize === "grand"),
          `${y} 缺大賞行`
        );
      } else {
        assert(
          entries.some((e) => e.prize === "gold"),
          `${y} 缺金賞行`
        );
      }
    }
    assert(
      MOE_AWARDS.filter((e) => e.year === 2011 && e.prize === "silver").length === 2,
      "2011 应有两行銀賞"
    );
    assert(
      MOE_AWARDS.filter((e) => e.year === 2013 && e.prize === "semi").length === 2,
      "2013 应有两行準大賞"
    );
  });

  await check("大赏数据：Getchu 美少女ゲーム大賞（部门 / 名次 / 排序）", async () => {
    assert(GETCHU_AWARDS.length >= 400, `Getchu 条目太少：${GETCHU_AWARDS.length}`);
    const seenRanks = new Set<string>();
    for (const entry of GETCHU_AWARDS) {
      assert(GETCHU_DEPT_ORDER[entry.dept] !== undefined, `未知部门：${entry.dept}`);
      assert(entry.title.length > 0, `${entry.year}/${entry.dept}/第${entry.rank}位 缺标题`);
      assert(entry.rank >= 1, `${entry.year}/${entry.dept} 名次异常：${entry.rank}`);
      assert(
        entry.vnId === null || /^v\d+$/.test(entry.vnId),
        `${entry.year}/${entry.dept}/第${entry.rank}位 vnId 形状：${entry.vnId}`
      );
      const rankKey = `${entry.year}:${entry.dept}:${entry.rank}`;
      assert(!seenRanks.has(rankKey), `Getchu 名次重复：${rankKey}`);
      seenRanks.add(rankKey);
    }
    // 年份降序 → 部门顺序 → 名次升序
    for (let i = 1; i < GETCHU_AWARDS.length; i += 1) {
      const prev = GETCHU_AWARDS[i - 1]!;
      const curr = GETCHU_AWARDS[i]!;
      assert(
        prev.year > curr.year ||
          (prev.year === curr.year &&
            (GETCHU_DEPT_ORDER[prev.dept] < GETCHU_DEPT_ORDER[curr.dept] ||
              (GETCHU_DEPT_ORDER[prev.dept] === GETCHU_DEPT_ORDER[curr.dept] &&
                prev.rank <= curr.rank))),
        "Getchu 应按 年份→部门→名次 排"
      );
    }
    // 年份 coverage：2003–2023 全年在，総合部门每个年至少 5 条
    assert(getchuYears().length >= 20, `Getchu 年份不全：${getchuYears().length}`);
    for (const y of getchuYears()) {
      assert(getchuEntriesFor(y, "total").length >= 5, `${y} 的総合部门条目太少`);
    }
    // 早年短暂出现过的部门（作品命名 / 配音 / 主题曲 / Vocal / BGM）也要有数据
    for (const dept of ["naming", "voice", "theme", "vocal", "bgm"] as const) {
      assert(
        GETCHU_AWARDS.some((entry) => entry.dept === dept),
        `Getchu 缺部门数据：${dept}`
      );
    }
  });

  await check("题材列表：合并（去重 / 屏蔽 / 顺序）", () => {
    const base = [
      { id: "g1", name: "奇幻" },
      { id: "g2", name: "悬疑" },
      { id: "g3", name: "学园" },
    ];
    // 基础 ∪ 自加；同一 id 只留基础位；被删的基础候选不再出现
    const pool = mergeTagPool(
      base,
      [
        { id: "g4", name: "百合" },
        { id: "g2", name: "悬疑" },
      ],
      ["g3"]
    );
    const joined = pool.map((tag) => tag.id).join(",");
    assert(joined === "g1,g2,g4", `合并结果不对：${joined}`);
    assert(mergeTagPool([], [], []).length === 0, "全空应得空列表");
  });

  await check("题材列表：增删记入 KV（自加直接删 / 基础候选进屏蔽名单）", async () => {
    await loadTagPool();
    const fresh = getTagPoolState();
    assert(fresh.loaded && fresh.added.length === 0, "首读应为空");
    assert(fresh.removed.length === 0, "首读屏蔽名单应为空");

    await addPoolTags([{ id: "g9", name: "百合" }]);
    assert(
      getTagPoolState()
        .added.map((tag) => tag.id)
        .join(",") === "g9",
      "自加应记入 added"
    );
    // 重复加不生效
    await addPoolTags([
      { id: "g9", name: "百合" },
      { id: "g8", name: "学园" },
    ]);
    assert(
      getTagPoolState()
        .added.map((tag) => tag.id)
        .join(",") === "g9,g8",
      "自加应去重之后再追加"
    );

    await removePoolTags(["g9", "g5"], ["g5"]);
    assert(
      getTagPoolState()
        .added.map((tag) => tag.id)
        .join(",") === "g8",
      "自加移除应直接删；非自加不该动 added"
    );
    assert(
      getTagPoolState().removed.length === 1 && getTagPoolState().removed[0] === "g5",
      "基础候选删除应记入屏蔽名单"
    );

    await addPoolTags([{ id: "g5", name: "奇幻" }]);
    assert(!getTagPoolState().removed.includes("g5"), "被删的候选加回来应撤销屏蔽");

    // 落盘形状：重进应用还能读回来（KV 序列化为数组）
    const savedAdded = JSON.parse(memoryStore.get("ranking_tag_pool_added") ?? "null");
    const savedRemoved = JSON.parse(memoryStore.get("ranking_tag_pool_removed") ?? "null");
    assert(
      Array.isArray(savedAdded) && savedAdded.length === 2,
      `added 应落成 KV 数组：${String(savedAdded)}`
    );
    assert(Array.isArray(savedRemoved) && savedRemoved.length === 0, "removed 应落成 KV 数组");
  });

  await check("浏览筛选：题材组合编译（AND）/ 题材名字典（KV 回读）", async () => {
    // 编译：每个题材一条 tag 谓词（AND 语义都要命中），与原语言等一起包进 and
    const compiled = compileVnFilters({ tags: ["g1", "g2"], olang: ["ja"] });
    assert(compiled?.[0] === "and", "多个筛选应包在 and 里");
    const tagParts = (compiled!.slice(1) as unknown[][]).filter(
      (p) => Array.isArray(p) && p[0] === "tag"
    );
    assert(
      tagParts.length === 2 && tagParts.every((p) => p[1] === "="),
      `每个题材都应有 tag 谓词：${JSON.stringify(tagParts)}`
    );
    assert(compileVnFilters(undefined) === undefined, "未设筛选不产生谓词");
    assert(compileVnFilters({}) === undefined, "空对象不产生谓词");

    // 名字典：记录（补缺不覆盖）→ 同步读取 → KV 落盘形状
    await loadTagNames();
    assert(getTagName("g10001") === undefined, "初始字典应为空");
    await recordTagNames([{ id: "g10001", name: "奇幻" }]);
    assert(getTagName("g10001") === "奇幻", "应记录名字");
    await recordTagNames([{ id: "notag1", name: "非题材 id" }]);
    assert(getTagName("notag1") === undefined, "非 g 开头的 id 不应记录");
    await loadTagNames();
    assert(getTagName("g10001") === "奇幻", "重复 load 幂等，不冲掉内存");
    const saved = JSON.parse(memoryStore.get("browse_tag_names") ?? "null");
    assert(
      saved && typeof saved === "object" && saved.g10001 === "奇幻",
      `KV 应是 id→名字 的对象：${String(saved)}`
    );
    // 已记录的同名再记一次不改状态（省一次写盘）
    const snapshot = getTagNames();
    await recordTagNames([{ id: "g10001", name: "奇幻" }]);
    assert(getTagNames() === snapshot, "重复同名记录不应变更状态");
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
