/**
 * 游玩记录的展示格式（纯函数）。
 *
 * 文案取当前语言（全局 `t`）；紧凑格式 `12.5 h` / `40 m` 与语言无关，不走目录。
 */

import { t } from "@/lib/i18n/translate";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 毫秒 → 详细时长：`1 小时 23 分` / `45 分钟` / `30 秒` */
export function formatPlayDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return t("records.duration.seconds", { seconds: totalSeconds });
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t("records.duration.minutes", { minutes });
  if (minutes === 0) return t("records.duration.hours", { hours });
  return t("records.duration.hoursMinutes", { hours, minutes });
}

/** 毫秒 → 紧凑时长（统计块用）：`12.5 h` / `40 m` */
export function formatPlayDurationShort(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} m`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1).replace(/\.0$/, "")} h`;
  return `${Math.round(hours)} h`;
}

/** unix 毫秒 → `2026-10-09`（本地时区） */
export function formatSessionDate(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** unix 毫秒 → `14:30`（本地时区） */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 年 + 月（0–11）→ `2026 年 10 月` */
export function formatYearMonth(year: number, monthIndex: number): string {
  return t("records.yearMonth", { year, month: monthIndex + 1 });
}
