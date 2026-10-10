/**
 * 浏览历史的展示档位与路由映射。
 *
 * 四个档位对应需求里的「作品 / 人员 / 用户 / 厂商」；
 * 「人员」聚合**角色 + 制作人员**两种存储类型（都是「人员」，
 * 合为一档正好覆盖全部详情页，不丢任何一类）。
 */

import type { SegmentedOption } from "@/components/segmented-control";
import { isValidDate } from "@/features/ulist/entry-logic";
import type { HistoryType } from "@/lib/db/dao/history";
import type { TranslationKey } from "@/lib/i18n/translate";

/** 展示档位 */
export type HistoryTab = "vn" | "people" | "user" | "producer";

/** 档位 → 存储类型集合 */
export const HISTORY_TAB_TYPES: Record<HistoryTab, HistoryType[]> = {
  vn: ["vn"],
  people: ["character", "staff"],
  user: ["user"],
  producer: ["producer"],
};

/** 分段控件的选项（顺序即展示顺序；**存翻译键**，渲染时用 `historyTabOptions`） */
export const HISTORY_TAB_OPTIONS: readonly { value: HistoryTab; labelKey: TranslationKey }[] = [
  { value: "vn", labelKey: "history.tabVn" },
  { value: "people", labelKey: "history.tabPeople" },
  { value: "user", labelKey: "history.tabUser" },
  { value: "producer", labelKey: "history.tabProducer" },
];

/** 渲染期把档位翻成带文案的选项（分段控件与清空弹窗共用） */
export function historyTabOptions(
  t: (key: TranslationKey) => string
): SegmentedOption<HistoryTab>[] {
  return HISTORY_TAB_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));
}

/** 存储类型 → 详情页路由（`as const` 让 expo-router 的类型推断能通过） */
export const HISTORY_TYPE_ROUTE = {
  vn: "/vn/[id]",
  character: "/character/[id]",
  staff: "/staff/[id]",
  producer: "/producer/[id]",
  user: "/user/[id]",
} as const;

/* -------------------------------------------------------------------------- */
/* 日期筛选（自定义开始 / 结束日期）                                            */
/* -------------------------------------------------------------------------- */

/**
 * 日期筛选：开始 / 结束日期，均为 `YYYY-MM-DD` 或空串（该端不限）。
 *
 * 主路径是**自定义**两个日期（Master 要求：不能只给固定时间段）；
 * 「全部 / 今天 / 近 7 天 / 近 30 天」只是把两个日期快速填好的快捷方式。
 */
export interface HistoryDateFilter {
  start: string;
  end: string;
}

export const EMPTY_DATE_FILTER: HistoryDateFilter = { start: "", end: "" };

export function isDateFilterEmpty(filter: HistoryDateFilter): boolean {
  return filter.start === "" && filter.end === "";
}

/** `YYYY-MM-DD` → 8 位数字 `YYYYMMDD`（非数字字符丢弃，供 InputOTP 用） */
export function isoToDigits(iso: string): string {
  return iso.replace(/\D/g, "").slice(0, 8);
}

/** 8 位数字 `YYYYMMDD` → `YYYY-MM-DD`；不足 8 位返回空串 */
export function digitsToIso(digits: string): string {
  if (digits.length !== 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * 单个日期（8 位数字）的校验错误；合法 / 未填时为 null。
 *
 * 未填满 8 位时提示「请填满 8 位」而不是格式错误 —— OTP 输入本来就在逐位敲，
 * 中途报「格式不对」没有意义。返回翻译键，由调用方翻成文案。
 */
export function dateDigitsFieldError(digits: string): TranslationKey | null {
  if (digits === "") return null;
  if (digits.length < 8) return "history.dateIncomplete";
  return isValidDate(digitsToIso(digits)) ? null : "history.dateInvalid";
}

/** 开始 / 结束两个日期（均为 8 位数字）的校验错误（翻译键）；合法时为 null */
export function dateDigitsRangeErrors(
  startDigits: string,
  endDigits: string
): { start: TranslationKey | null; end: TranslationKey | null } {
  const startError = dateDigitsFieldError(startDigits);
  const endError = dateDigitsFieldError(endDigits);
  if (startError || endError) return { start: startError, end: endError };

  const start = digitsToIso(startDigits);
  const end = digitsToIso(endDigits);
  if (start && end && end < start) return { start: null, end: "history.dateRangeOrder" };
  return { start: null, end: null };
}

/** 快捷时间段 */
export type HistoryPreset = "all" | "today" | "week" | "month";

/** 快捷时间段的选项（**存翻译键**，渲染时用 `historyPresetOptions`） */
export const HISTORY_PRESET_OPTIONS: readonly { value: HistoryPreset; labelKey: TranslationKey }[] =
  [
    { value: "all", labelKey: "common.all" },
    { value: "today", labelKey: "history.presetToday" },
    { value: "week", labelKey: "history.presetWeek" },
    { value: "month", labelKey: "history.presetMonth" },
  ];

/** 渲染期把快捷时间段翻成带文案的选项 */
export function historyPresetOptions(
  t: (key: TranslationKey) => string
): SegmentedOption<HistoryPreset>[] {
  return HISTORY_PRESET_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * 快捷时间段 → 具体的开始 / 结束日期（本地时区，含首尾两天）。
 *
 * 纯函数（`now` 可注入），冒烟直接测。
 */
export function presetDateFilter(preset: HistoryPreset, now = new Date()): HistoryDateFilter {
  if (preset === "all") return { start: "", end: "" };
  const end = isoOf(now);
  if (preset === "today") return { start: end, end };
  const start = new Date(now);
  // 近 7 天 = 含今天在内共 7 天 → 往前 6 天
  start.setDate(start.getDate() - (preset === "week" ? 6 : 29));
  return { start: isoOf(start), end };
}

/** `YYYY-MM-DD` → 当天 00:00:00.000 的本地时间戳（非法日期返回 null） */
function dayStart(iso: string): number | null {
  if (!isValidDate(iso)) return null;
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0).getTime();
}

/** `YYYY-MM-DD` → 当天 23:59:59.999 的本地时间戳（非法日期返回 null） */
function dayEnd(iso: string): number | null {
  if (!isValidDate(iso)) return null;
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999).getTime();
}

/**
 * 日期筛选 → 时间上下界（unix 毫秒，**含边界**）。
 *
 * 结束日期取当天最后一毫秒 —— 否则「结束 = 今天」会把今天浏览的记录全漏掉。
 */
export function dateFilterBounds(filter: HistoryDateFilter): {
  since: number | null;
  until: number | null;
} {
  return {
    since: filter.start ? dayStart(filter.start) : null,
    until: filter.end ? dayEnd(filter.end) : null,
  };
}
