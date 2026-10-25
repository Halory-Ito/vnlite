/**
 * 日期工具：`YYYY-MM-DD` ↔ 8 位数字 `YYYYMMDD`，以及日期输入的校验。
 *
 * 日期输入走 `InputOTP`（`components/date-otp-field`），组件内部用 8 位数字，
 * 对外值仍是 `YYYY-MM-DD`；未填满时给出**部分日期**（如 `2023-0`），
 * 以便保留逐位输入的中途状态（否则每次键盘落位都会被清回去）。
 */

import type { TranslationKey } from "@/lib/i18n/translate";

/** 严格校验 `YYYY-MM-DD`（`2023-02-31` 这类不存在的日期也要挡住） */
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** `YYYY-MM-DD`（可残缺）→ 8 位数字 `YYYYMMDD`（非数字字符丢弃，供 InputOTP 用） */
export function isoToDigits(iso: string): string {
  return iso.replace(/\D/g, "").slice(0, 8);
}

/** 8 位数字 `YYYYMMDD` → `YYYY-MM-DD`；不足 8 位返回空串 */
export function digitsToIso(digits: string): string {
  if (digits.length !== 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * 残缺数字 → 带分隔符的部分日期，逐位拼出 `2023` / `2023-0` / `2023-01-2`。
 *
 * 不能直接用 `digitsToIso`：它把不足 8 位一律当空串，OTP 输入会被清回去。
 */
export function digitsToPartialIso(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

/**
 * 单个日期的校验错误；合法 / 未填时为 null。
 *
 * 未填满 8 位时提示「请填满 8 位」而不是格式错误 —— OTP 输入本来就在逐位敲，
 * 中途报「格式不对」没有意义。返回翻译键，由调用方翻成文案。
 */
export function dateFieldError(iso: string): TranslationKey | null {
  if (iso === "") return null;
  const digits = isoToDigits(iso);
  if (digits.length < 8) return "dateField.incomplete";
  return isValidDate(iso) ? null : "dateField.invalid";
}

/** 开始 / 结束两个日期的校验错误（格式 / 位数 / 顺序）；合法时为 null */
export function dateRangeErrors(
  start: string,
  end: string
): { start: TranslationKey | null; end: TranslationKey | null } {
  const startError = dateFieldError(start);
  const endError = dateFieldError(end);
  if (startError || endError) return { start: startError, end: endError };

  // 走到这里两端要么为空、要么是合法日期，字符串比较即可判顺序
  if (start !== "" && end !== "" && end < start)
    return { start: null, end: "dateField.rangeOrder" };
  return { start: null, end: null };
}
