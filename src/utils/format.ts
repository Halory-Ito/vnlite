/**
 * 展示层格式化工具。
 *
 * VNDB 的原始字段很多是「部分日期」「枚举数字」「空值」，
 * 全部集中在这里转成能直接上屏的文案，避免每个页面各写一遍。
 */

import {
  DEV_STATUS,
  LENGTH,
  LANGUAGE_LABEL,
  LIST_STATUS,
  PLATFORM_LABEL,
  SEX_LABEL,
  STAFF_ROLE_LABEL,
  VOICED_LABEL,
  type Language,
  type Length,
  type Platform,
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
  if (!raw) return "未知";
  if (raw === TBA) return "预定";
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
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
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

/* -------------------------------------------------------------------------- */
/* 评分                                                                        */
/* -------------------------------------------------------------------------- */

/** 贝叶斯评分 0–100 → `90.4`，保留一位小数 */
export function formatRating(rating: number | null | undefined): string {
  if (rating == null) return "—";
  return rating.toFixed(1);
}

/** `0.904` → `90.4`（把 0–10 的 average 统一到 0–100 便于比较） */
export function averageToRating(average: number | null | undefined): number | null {
  if (average == null) return null;
  return average * 10;
}

/** 投票数缩写：`1.2k` / `13k` */
export function formatCount(count: number | null | undefined): string {
  if (count == null) return "—";
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
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

/** 1–5 → 时长描述；0/undefined → 未知 */
export function formatLength(length: Length | null | undefined): string {
  if (!length) return "未知";
  return LENGTH[length] ?? "未知";
}

/** 分钟数 → `约 12 小时` / `约 40 分钟` */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = minutes / 60;
  if (hours < 10) return `约 ${hours.toFixed(1).replace(/\.0$/, "")} 小时`;
  return `约 ${Math.round(hours)} 小时`;
}

export function languageLabel(lang: string | null | undefined): string {
  if (!lang) return "未知";
  return LANGUAGE_LABEL[lang as Language] ?? lang;
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform as Platform] ?? platform.toUpperCase();
}

export function platformListLabel(platforms: readonly string[] | undefined): string {
  if (!platforms || platforms.length === 0) return "未知";
  return platforms.map(platformLabel).join(" · ");
}

export function staffRoleLabel(role: StaffRole | string | undefined): string {
  if (!role) return "其他";
  return STAFF_ROLE_LABEL[role as StaffRole] ?? role;
}

export function devStatusLabel(status: number | null | undefined): string {
  if (status == null) return "未知";
  return DEV_STATUS[status] ?? "未知";
}

/** 发行版持有状态（0–4）→ 英文（与 VNDB 一致，见 `LIST_STATUS`） */
export function listStatusLabel(status: number | null | undefined): string {
  if (status == null) return "Unknown";
  return LIST_STATUS[status] ?? "Unknown";
}

export function voicedLabel(voiced: number | null | undefined): string {
  if (voiced == null) return "未知";
  return VOICED_LABEL[voiced as keyof typeof VOICED_LABEL] ?? "未知";
}

/** `sex` / `gender` 字段是 `[表观, 真实]` 二元组，null 表示未知 */
export function sexLabel(pair: readonly (string | null)[] | null | undefined): string {
  if (!pair || pair.length === 0) return "未知";
  const [apparent, real] = pair;
  if (!apparent) return "未知";
  const apparentLabel = SEX_LABEL[apparent as keyof typeof SEX_LABEL] ?? apparent;
  if (!real || real === apparent) return apparentLabel;
  return `${apparentLabel}（实际：${SEX_LABEL[real as keyof typeof SEX_LABEL] ?? real}）`;
}

/* -------------------------------------------------------------------------- */
/* VNDB 关系类型                                                                */
/* -------------------------------------------------------------------------- */

const RELATION_LABEL: Record<string, string> = {
  seq: "续作",
  preq: "前传",
  ser: "系列",
  alt: "替代版本",
  char: "登场角色",
  parent: "母作",
  side: "番外",
};

export function relationLabel(relation: string | undefined): string {
  if (!relation) return "关联";
  return RELATION_LABEL[relation] ?? relation;
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
