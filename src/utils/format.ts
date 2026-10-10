/**
 * 展示层格式化工具。
 *
 * VNDB 的原始字段很多是「部分日期」「枚举数字」「空值」，
 * 全部集中在这里转成能直接上屏的文案，避免每个页面各写一遍。
 *
 * ⚠️ 这里的文案走**全局 `t`**（`lib/i18n/translate`），不是组件 hook ——
 * 这些函数也会被纯逻辑调用（冒烟测试直接跑）。语言切换时由 `initI18n`
 * 同步全局 locale，订阅了语言偏好的页面会带着它们一起重渲染。
 */

import { t, type TranslationKey } from "@/lib/i18n/translate";
import {
  CHARACTER_ROLE,
  DEV_STATUS,
  LANGUAGE,
  LENGTH,
  LIST_STATUS,
  PLATFORM,
  PRODUCER_TYPE,
  SEX,
  STAFF_ROLE,
  VOICED,
  type Length,
  type StaffRole,
} from "@/lib/api/enums";

/* -------------------------------------------------------------------------- */
/* 日期                                                                        */
/* -------------------------------------------------------------------------- */

/** `TBA` = to be announced，未定档 */
export const TBA = "TBA";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * 发布日期。
 *
 * VNDB 的 `released` 可能是：
 *   `2018-02-23` 完整 / `2018-05` 到月 / `2018` 到年 / `TBA` 未定 / `undefined` 未知
 * 不完整日期**不能**按字符串补零解析成年月日。
 */
export function formatReleased(raw: string | null | undefined): string {
  if (!raw) return t("format.unknown");
  if (raw === TBA) return t("format.tba");
  return raw;
}

/** 只取年份，用于分组与统计 */
export function releasedYear(raw: string | null | undefined): number | null {
  if (!raw || raw === TBA) return null;
  const year = Number.parseInt(raw.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/** `2024-01-05` → `2 天前`（只处理完整日期） */
export function formatRelativeDays(raw: string | null | undefined): string | null {
  if (!raw || raw === TBA) return null;
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 0) return raw;
  if (days === 0) return t("format.today");
  if (days === 1) return t("format.yesterday");
  if (days < 30) return t("format.daysAgo", { days });
  if (days < 365) return t("format.monthsAgo", { months: Math.floor(days / 30) });
  return t("format.yearsAgo", { years: Math.floor(days / 365) });
}

/**
 * unix 毫秒 → `刚刚` / `N 分钟前` / `N 小时前` / `N 天前` / `YYYY-MM-DD`。
 *
 * 浏览历史用（记录的是毫秒时间戳）。超过 30 天退回具体日期。
 */
export function formatRelativeTime(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  const diff = Date.now() - timestamp;
  if (diff < 0) return null;

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("format.justNow");
  if (minutes < 60) return t("format.minutesAgo", { minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("format.hoursAgo", { hours });

  const days = Math.floor(hours / 24);
  if (days < 30) return t("format.daysAgo", { days });

  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** unix 秒 → `2024-01-05` */
export function formatUnixDate(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 今天（本地时区）→ `2024-01-05`，清单日期输入的「今天」快捷键用 */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `2024-01-05` → `1 月 5 日`（中文）/ `1/5`（英文） */
export function formatMonthDay(iso: string): string {
  const [, month, day] = iso.split("-");
  if (!month || !day) return iso;
  return t("format.monthDay", { month: Number(month), day: Number(day) });
}

/* -------------------------------------------------------------------------- */
/* 评分                                                                        */
/* -------------------------------------------------------------------------- */

/** 贝叶斯评分 0–100 → `90.4`，保留一位小数 */
export function formatRating(rating: number | null | undefined): string {
  if (rating == null) return "—";
  return rating.toFixed(1);
}

/** 投票数缩写：`1.2k` / `13k` */
export function formatCount(count: number | null | undefined): string {
  if (count == null) return "—";
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")} k`;
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
}

/** 评分对应的语义色，UI 用它决定 badge 配色 */
export function ratingTone(rating: number | null | undefined): "high" | "mid" | "low" | "none" {
  if (rating == null) return "none";
  if (rating >= 85) return "high";
  if (rating >= 70) return "mid";
  return "low";
}

/* -------------------------------------------------------------------------- */
/* 枚举 → 文案                                                                  */
/* -------------------------------------------------------------------------- */

/** 把枚举值集合转成字符串集合，用于「是不是合法的枚举值」判断 */
function enumSet(values: readonly (string | number)[]): Set<string> {
  return new Set(values.map(String));
}

const PLATFORM_SET = enumSet(PLATFORM);
const STAFF_ROLE_SET = enumSet(STAFF_ROLE);
const LANGUAGE_SET = enumSet(LANGUAGE);
const SEX_SET = enumSet(SEX);
const VOICED_SET = enumSet(VOICED);
const PRODUCER_TYPE_SET = enumSet(PRODUCER_TYPE);
const CHARACTER_ROLE_SET = enumSet(CHARACTER_ROLE);
/** `/vn` 的 relations.relation 固定 7 种（与 `RELATION_LABEL` 一致） */
const RELATION_SET = new Set(["seq", "preq", "ser", "alt", "char", "parent", "side"]);

/** 1–5 → 时长描述；0/undefined → 未知 */
export function formatLength(length: Length | null | undefined): string {
  if (!length) return t("format.unknown");
  return LENGTH[length] ?? t("format.unknown");
}

/** 分钟数 → `约 12 小时` / `约 40 分钟` */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} m`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1).replace(/\.0$/, "")} h`;
  return `${Math.round(hours)} h`;
}

export function languageLabel(lang: string | null | undefined): string {
  if (!lang) return t("format.unknown");
  // 不在 VNDB 语言枚举里就原样返回，别让 i18n 输出 missing 占位
  if (!LANGUAGE_SET.has(lang)) return lang;
  return t(`format.language.${lang}` as TranslationKey);
}

export function platformLabel(platform: string): string {
  if (!PLATFORM_SET.has(platform)) return platform.toUpperCase();
  return t(`enums.platform.${platform}` as TranslationKey);
}

export function platformListLabel(platforms: readonly string[] | undefined): string {
  if (!platforms || platforms.length === 0) return t("format.unknown");
  return platforms.map(platformLabel).join(" · ");
}

export function staffRoleLabel(role: StaffRole | string | undefined): string {
  if (!role) return t("common.none");
  if (!STAFF_ROLE_SET.has(role)) return role;
  return t(`enums.staffRole.${role}` as TranslationKey);
}

export function devStatusLabel(status: number | null | undefined): string {
  if (status == null || status < 0 || status >= DEV_STATUS.length) return t("format.unknown");
  return t(`enums.devStatus.${status}` as TranslationKey);
}

/** 制作者类型：公司 / 个人 / 业余团体 */
export function producerTypeLabel(type: string | null | undefined): string {
  if (!type || !PRODUCER_TYPE_SET.has(type)) return type ?? "";
  return t(`enums.producerType.${type}` as TranslationKey);
}

/** 角色在本作中的定位：主角 / 主要角色 / 次要角色 / 登场 */
export function characterRoleLabel(role: string | null | undefined): string {
  if (!role || !CHARACTER_ROLE_SET.has(role)) return role ?? "";
  return t(`enums.characterRole.${role}` as TranslationKey);
}

/** 发行版持有状态（0–4）→ 英文（与 VNDB 一致，见 `LIST_STATUS`） */
export function listStatusLabel(status: number | null | undefined): string {
  if (status == null) return "Unknown";
  return LIST_STATUS[status] ?? "Unknown";
}

export function voicedLabel(voiced: number | null | undefined): string {
  if (voiced == null || !VOICED_SET.has(String(voiced))) return t("format.unknown");
  return t(`enums.voiced.${voiced}` as TranslationKey);
}

/** `sex` / `gender` 字段是 `[表观, 真实]` 二元组，null 表示未知 */
export function sexLabel(pair: readonly (string | null)[] | null | undefined): string {
  if (!pair || pair.length === 0) return t("format.unknown");
  const [apparent, real] = pair;
  if (!apparent) return t("format.unknown");
  const apparentLabel = SEX_SET.has(apparent)
    ? t(`enums.sex.${apparent}` as TranslationKey)
    : apparent;
  if (!real || real === apparent) return apparentLabel;
  const realLabel = SEX_SET.has(real) ? t(`enums.sex.${real}` as TranslationKey) : real;
  return t("format.sexWithReal", { apparent: apparentLabel, real: realLabel });
}

/* -------------------------------------------------------------------------- */
/* VNDB 关系类型                                                                */
/* -------------------------------------------------------------------------- */

export function relationLabel(relation: string | undefined): string {
  if (!relation || !RELATION_SET.has(relation)) return t("enums.relationDefault");
  return t(`enums.relation.${relation}` as TranslationKey);
}

/* -------------------------------------------------------------------------- */
/* 其它                                                                        */
/* -------------------------------------------------------------------------- */

/** HTML 实体反转义。VNDB 的 `description` 里偶有 `&amp;` `&quot;` 等 */
export function decodeHtmlEntities(text: string): string {
  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => map[m] ?? m);
}

/** VNDB 图片 URL 支持 `t.`（缩略图）前缀，列表页用小图省流量 */
export function toThumbnailUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace("//t.vndb.org/", "//t.vndb.org/");
}

/** 取列表页默认条数（受 Kana 的 100 上限约束） */
export const SAFE_PAGE_SIZE = 25;
