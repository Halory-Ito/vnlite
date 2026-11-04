import { createContext, useContext } from "react";

export interface CalendarDayTheme {
  accent: string;
  accentForeground: string;
  defaultColor: string;
  dayLabel: (day: number) => string;
}

export const CalendarDayContext = createContext<CalendarDayTheme | null>(null);

export function useCalendarDayTheme(): CalendarDayTheme {
  const theme = useContext(CalendarDayContext);
  if (!theme) throw new Error("CalendarDay 必须在 CalendarDayContext 里使用");
  return theme;
}
