/**
 * 日期格的共享样式 / 文案。
 *
 * `CalendarList` 每页都是 42 个日期格，每个格子里再调 `useTranslation` +
 * `useThemeColor` 会很浪费；这里在翻页器那一层算一次，格子只读 Context。
 */

import { createContext, useContext } from "react";

export interface CalendarDayTheme {
  accent: string;
  accentForeground: string;
  /** 「10 日，查看当天发售」 */
  dayLabel: (day: number) => string;
}

export const CalendarDayContext = createContext<CalendarDayTheme | null>(null);

export function useCalendarDayTheme(): CalendarDayTheme {
  const theme = useContext(CalendarDayContext);
  if (!theme) throw new Error("CalendarDay 必须在 CalendarDayContext 里使用");
  return theme;
}
