/**
 * 应用偏好设置。
 *
 * 全部走 AsyncStorage（KV 层），不进 SQLite —— 读写频繁、量小、结构简单。
 *
 * 内部是「模块级缓存 + 订阅者」模式，供 `src/hooks/use-preferences.ts`
 * 用 `useSyncExternalStore` 接到 React 树上（NSFW 档位会影响所有图片渲染）。
 */

import { kv } from "./key-value";
import { BACKGROUND_BLUR_RANGE, DEFAULT_BACKGROUND_OPACITY } from "@/theme/background";

/** NSFW 内容展示档位（Q6） */
export type NsfwMode = "hide" | "blur" | "show";

/**
 * 明暗模式三态。
 *
 * Uniwind 的 `colorScheme` 只在初始化时读一次 `Appearance.getColorScheme()`，
 * 没有公开 API 强制；但 RN 的 `Appearance.setColorScheme()` 可以（仅影响 App 内，
 * 不改系统 UI），这是我们做手动切换的唯一入口。
 */
export type ColorSchemePreference = "system" | "light" | "dark";

/**
 * 背景图遮罩强度（**已废弃**，仅用于旧数据迁移）。
 *
 * 原来是 0/1/2/3 四档，粒度太粗 —— 0.35 与 0.6 之间的观感差异很大，
 * 四档怎么选都不满意。现已被 `backgroundOpacity`（0–1 连续）取代。
 */
export type BackgroundDim = 0 | 1 | 2 | 3;

/**
 * 旧四档 → 连续不透明度。仅供迁移，勿在新代码里使用。
 *
 * 注意 `2` 这一档是当年的**默认值**（不是用户自己选的），实测 0.6 挡不住
 * 背景图的高光区，所以迁移时按新的默认 `DEFAULT_BACKGROUND_OPACITY` 走；
 * 其余档位按原值等比保留。
 */
const LEGACY_DIM_OPACITY: Record<BackgroundDim, number> = {
  0: 0,
  1: 0.4,
  2: DEFAULT_BACKGROUND_OPACITY,
  3: 0.88,
};

// 范围与默认值都住在 theme/background.ts（纯逻辑，冒烟测试可直接 import），
// 这里只是转出去，设置页与滑杆统一从一处取。
export { BACKGROUND_BLUR_RANGE, BACKGROUND_OPACITY_RANGE } from "@/theme/background";

/** 浏览页可用的排序字段（与 `features/sort/sortOptions` 的选项一一对应） */
export type BrowseSortField = "votecount" | "rating" | "released" | "id";

/** 浏览页的排序偏好（字段 + 方向） */
export interface BrowseSortPreference {
  field: BrowseSortField;
  reverse: boolean;
}

/**
 * 列表卡片上显示哪些信息（「浏览」页的面板里调）。
 *
 * 与筛选条件是两回事：这里只影响卡片外观，不影响请求。存本地，跨启动记住。
 * 标题和封面永远显示，所以不在这里。
 */
export const CARD_FIELD = [
  "rating",
  "released",
  "olang",
  "length",
  "platforms",
  "devstatus",
] as const;

export type CardField = (typeof CARD_FIELD)[number];

export const CARD_FIELD_LABEL: Record<CardField, string> = {
  rating: "评分",
  released: "发售日期",
  olang: "原语言",
  length: "时长",
  platforms: "平台",
  devstatus: "开发状态",
};

/**
 * 作品列表的两种视图。
 *
 * `grid` 是**默认**：挑作品时封面比文字有效得多；要看打分 / 标签 / 状态再切 `list`。
 * 清单 Tab 与制作者详情的「作品」页签共用这一个偏好（`preferences.vnViewMode`）。
 */
export type VnViewMode = "grid" | "list";

export interface Preferences {
  /** NSFW 图片处理，默认 blur */
  nsfwMode: NsfwMode;
  /**
   * 作品列表的视图模式（清单 Tab / 制作者详情的「作品」页签共用）。
   * `grid` = 纯封面网格（默认），`list` = 带元信息的行。
   */
  vnViewMode: VnViewMode;
  /** 每页条数，上限 100（Kana 硬限制） */
  pageSize: number;
  /** 浏览页排序（默认：人气降序） */
  browseSort: BrowseSortPreference;
  /** 列表卡片显示哪些信息 */
  cardFields: CardField[];
  /** 首次使用是否已看过引导 */
  hasSeenOnboarding: boolean;

  /* ---- 主题 ---- */
  /** 明暗三态 */
  colorScheme: ColorSchemePreference;
  /** 主题包 id，对应 `src/theme/themes.ts` 里的 `ThemeDefinition` */
  themeId: string;
  /** 是否显示主题背景图 */
  showBackground: boolean;
  /**
   * 背景图上遮罩层的**不透明度**，0–1 连续。
   * 遮罩色 = 主题 `background` token，作用是把背景图往底色方向拉，
   * 保证前景文字对比度可控（比直接给底色加透明度安全，不会让文字一起变淡）。
   */
  backgroundOpacity: number;
  /** 背景图**模糊半径**（pt），0–40。给 `expo-image` 的 `blurRadius` */
  backgroundBlur: number;
  /**
   * 自定义背景图 URL。
   * M1 不用（主题包自带背景图），M4 开放用户自定义时启用。
   * 存 URL 而非图片数据 —— 避免往 AsyncStorage 里塞几 MB 的 base64。
   */
  backgroundUrl: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  nsfwMode: "blur",
  vnViewMode: "grid",
  pageSize: 25,
  browseSort: { field: "votecount", reverse: true },
  cardFields: [...CARD_FIELD],
  hasSeenOnboarding: false,
  colorScheme: "system",
  themeId: "air",
  showBackground: true,
  backgroundOpacity: DEFAULT_BACKGROUND_OPACITY,
  backgroundBlur: 0,
  backgroundUrl: null,
};

/** 浏览页排序可用字段（脏数据兜底用，与 `BrowseSortField` 保持一致） */
const BROWSE_SORT_FIELDS = new Set<BrowseSortField>(["votecount", "rating", "released", "id"]);

const KEY = "vnlite.preferences";

/** 同步可读的快照，供 useSyncExternalStore 用 */
let snapshot: Preferences = DEFAULT_PREFERENCES;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 从 AsyncStorage 读一次。首屏若还没读完，先用默认值渲染，不阻塞 UI */
export async function loadPreferences(): Promise<Preferences> {
  if (hydrated) return snapshot;
  const stored = await kv.get<Record<string, unknown>>(KEY);
  snapshot = migratePreferences(stored ?? {});
  hydrated = true;
  emit();
  return snapshot;
}

/**
 * 兼容旧版本存的数据。
 *
 * 除了「缺字段补默认值」，还要把已废弃的 `backgroundDim`(0–3 四档)
 * 换算成连续的 `backgroundOpacity`，否则老用户升级后遮罩直接变成 0（等于没遮）。
 *
 * 导出是为了冒烟测试能直接验证迁移规则（`bun run smoke:db`）。
 */
export function migratePreferences(stored: Record<string, unknown>): Preferences {
  const next: Preferences = { ...DEFAULT_PREFERENCES, ...(stored as Partial<Preferences>) };

  /*
   * 视图模式只认 grid / list，老数据没有这一项或存了脏值 → 回默认的网格。
   * 这个键 2026-09-30 从 `ulistViewMode` 改名成 `vnViewMode`（清单与制作者作品共用），
   * 旧键的值要接过来，否则老用户的选择会被重置。
   */
  const legacyViewMode = stored.ulistViewMode;
  // ⚠️ 读**原始存储**而不是合并默认值后的 `next`：否则默认的 "grid" 会盖掉旧键的值
  const viewMode = stored.vnViewMode ?? legacyViewMode;
  next.vnViewMode = viewMode === "list" ? "list" : "grid";
  delete (next as unknown as Record<string, unknown>).ulistViewMode;

  // 浏览页排序：字段与方向都校验一遍，脏值回默认（人气降序）；
  // 旧版本存过 `listSort`（本地清单排序，已随清单本地化一起废弃）——直接丢掉
  const sort = stored.browseSort as { field?: unknown; reverse?: unknown } | undefined;
  const field = BROWSE_SORT_FIELDS.has(sort?.field as BrowseSortField)
    ? (sort?.field as BrowseSortField)
    : DEFAULT_PREFERENCES.browseSort.field;
  next.browseSort = { field, reverse: sort?.reverse !== false };
  delete (next as unknown as Record<string, unknown>).listSort;

  if (typeof next.backgroundOpacity !== "number" || !Number.isFinite(next.backgroundOpacity)) {
    const legacyDim = stored.backgroundDim;
    next.backgroundOpacity =
      typeof legacyDim === "number"
        ? (LEGACY_DIM_OPACITY[clampDim(legacyDim)] ?? DEFAULT_PREFERENCES.backgroundOpacity)
        : DEFAULT_PREFERENCES.backgroundOpacity;
  }
  if (typeof next.backgroundBlur !== "number" || !Number.isFinite(next.backgroundBlur)) {
    next.backgroundBlur = DEFAULT_PREFERENCES.backgroundBlur;
  }

  // 越界值（手改过存储 / 旧版默认值）统一夹回区间，避免 UI 出现异常读数
  next.backgroundOpacity = clamp(next.backgroundOpacity, 0, 1);
  next.backgroundBlur = clamp(next.backgroundBlur, 0, BACKGROUND_BLUR_RANGE.max);

  // 卡片字段：旧数据没有这一项 → 全开；手改过的脏数据丢掉（空数组是合法的：只留标题+封面）
  next.cardFields = Array.isArray(next.cardFields)
    ? next.cardFields.filter(isCardField)
    : [...CARD_FIELD];

  delete (next as unknown as Record<string, unknown>).backgroundDim;
  return next;
}

function isCardField(value: unknown): value is CardField {
  return typeof value === "string" && (CARD_FIELD as readonly string[]).includes(value);
}

function clampDim(value: number): BackgroundDim {
  return (value <= 0 ? 0 : value <= 1 ? 1 : value <= 2 ? 2 : 3) as BackgroundDim;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getPreferences(): Preferences {
  return snapshot;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 单字段读取。缓存没就绪时返回默认值 */
export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return snapshot[key];
}

export async function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K]
): Promise<void> {
  const next = { ...snapshot, [key]: value };
  snapshot = next;
  emit();
  await kv.set(KEY, next);
}

/**
 * 只改内存快照、**不落盘**。
 *
 * 给滑块拖动这类高频场景用：拖动时每帧都调 `setPreference` 会把同一份
 * JSON 往 AsyncStorage 写几十次，拖起来会掉帧。
 * 正确姿势是拖动中 `patchPreferences`（UI 立即响应），
 * 松手 `onChangeEnd` 再 `setPreference` 落盘。
 */
export function patchPreferences(patch: Partial<Preferences>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export async function resetPreferences(): Promise<void> {
  snapshot = { ...DEFAULT_PREFERENCES };
  emit();
  await kv.set(KEY, snapshot);
}
