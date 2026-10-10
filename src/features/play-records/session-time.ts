/**
 * 游玩记录「设置」弹窗的纯逻辑（可冒烟）。
 *
 * 记录的可编辑信息是**开始时间 / 结束时间**，时长由两者之差算出。
 * 日期格式 `YYYY-MM-DD`，时间格式 `HH:mm`（本地时区）。
 */

import { isValidDate } from "@/features/ulist/entry-logic";
import { t } from "@/lib/i18n/translate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** `YYYY-MM-DD` + `HH:mm` → 本地时间戳（unix 毫秒）；非法返回 null */
export function toLocalTimestamp(dateIso: string, timeIso: string): number | null {
  if (!isValidDate(dateIso) || !TIME_RE.test(timeIso)) return null;
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hour, minute] = timeIso.split(":").map(Number);
  return new Date(year!, month! - 1, day!, hour!, minute!, 0, 0).getTime();
}

/** 单个「日期 + 时间」的校验错误；合法为 null */
export function dateTimeFieldError(dateIso: string, timeIso: string): string | null {
  if (!DATE_RE.test(dateIso) || !isValidDate(dateIso)) return t("records.error.dateFormat");
  if (!TIME_RE.test(timeIso)) return t("records.error.timeFormat");
  return null;
}

/** 结束早于开始时的错误；正常为 null */
export function sessionRangeError(startMs: number, endMs: number): string | null {
  return endMs < startMs ? t("records.error.range") : null;
}

/** 两个时间戳之间的时长（毫秒，负数按 0） */
export function durationBetween(startMs: number, endMs: number): number {
  return Math.max(0, endMs - startMs);
}

/** unix 毫秒 → `YYYY-MM-DD`（本地） */
export function formatLocalDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** unix 毫秒 → `HH:mm`（本地） */
export function formatLocalTime(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
