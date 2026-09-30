/**
 * 每日语录的本地缓存。
 *
 * 「每日」= **当天第一次打开时抽一条，之后整天不变**：
 *   - 日期键用本地时区的 `YYYY-MM-DD`（`todayIso()`），React Query 的 key 也带它，
 *     所以跨天自动换新
 *   - 同时落一份 AsyncStorage：杀掉进程重开还是同一条（只放内存的话重开会重新抽）
 *
 * 缓存整条语录（含 VN 标题），只有日期对不上才会重新请求。
 */

import type { Quote } from "@/lib/api/types";
import { todayIso } from "@/utils/format";

import { kv } from "./keyValue";

const KEY = "vnlite.daily_quote";

interface DailyQuoteRecord {
  /** 本地日期 `YYYY-MM-DD` */
  date: string;
  quote: Quote;
}

/** 纯函数：这份缓存是不是「今天」的（冒烟直接测它） */
export function isFreshDailyQuote(record: { date: string } | null, today: string): boolean {
  return record?.date === today;
}

/** 读当天缓存；不是今天（或没有）返回 null */
export async function readDailyQuote(today = todayIso()): Promise<Quote | null> {
  const record = await kv.get<DailyQuoteRecord>(KEY);
  return isFreshDailyQuote(record, today) ? (record as DailyQuoteRecord).quote : null;
}

/** 写入当天缓存 */
export async function writeDailyQuote(quote: Quote, today = todayIso()): Promise<void> {
  await kv.set<DailyQuoteRecord>(KEY, { date: today, quote });
}
