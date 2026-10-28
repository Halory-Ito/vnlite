/**
 * 月历（`react-native-calendars` 的 `CalendarList`）。
 *
 * 纵向分页：相邻月份都在原生 FlatList 里，滑到哪页露哪页，没有淡入淡出 /
 * 换月后才渲染的空窗期。`pagingEnabled` + 固定页高让一次手势翻一个月。
 *
 * 定制点：
 * - 星期行固定在列表外面：翻月时不会跟着滚走；页内 header 置空
 * - `dayComponent` → 今天空心圆 / 选中实心圆 / 有发售的小圆点
 * - 日期格的主题色与文案走 Context，42 个格子不各订阅一遍
 * - `weekVerticalMargin: 0`、`paddingHorizontal: 0`：页高和左右留白由我们自己控制
 */

import { useThemeColor } from "heroui-native";
import type { JSX, Ref } from "react";
import { memo, useCallback, useMemo } from "react";
import { View } from "react-native";
import { CalendarList, type DateData } from "react-native-calendars";

import { useTranslation } from "@/hooks/use-translation";
import type { MonthRef } from "@/features/calendar/lib/calendar";

import { CalendarDay } from "./calendar-day";
import { CalendarDayContext, type CalendarDayTheme } from "./calendar-day-context";
import { CALENDAR_PAGE_HEIGHT } from "./calendar-layout";
import { CalendarWeekHeader } from "./calendar-week-header";

/** `markedDates`：有发售 `marked`，选中 `selected` */
export type CalendarMarkedDates = Record<string, { marked?: boolean; selected?: boolean }>;

export interface CalendarListHandle {
  /** 跳到某个月（传 `YYYY-MM-01`） */
  scrollToMonth: (date: string) => void;
}

export interface CalendarListViewProps {
  /** 初始月份 `YYYY-MM-01`；挂载后不要再改（改 `current` 会强行滚回去） */
  initialMonth: string;
  /** 初始月份往前 / 往后能翻多少个月（覆盖 1950–2100） */
  pastScrollRange: number;
  futureScrollRange: number;
  markedDates: CalendarMarkedDates;
  onDayPress: (day: DateData) => void;
  onMonthChange: (month: MonthRef) => void;
  /** 一页的宽度（平板上限 560 - 左右 padding） */
  calendarWidth: number;
  listRef?: Ref<CalendarListHandle>;
}

/**
 * 透明底 + 去掉默认行间距；快速甩动时库会渲染占位页，
 * 把占位文字置透明，避免闪出一行 `2026-01-01`。
 *
 * ⚠️ 1.13.x 的样式覆盖读的是**扁平 key**（`theme['stylesheet.calendar-list.main']`），
 * 不是 `theme.stylesheet[...]`（类型声明和运行时不一致）。
 */
const THEME = {
  calendarBackground: "transparent",
  weekVerticalMargin: 0,
  "stylesheet.calendar-list.main": {
    placeholderText: { color: "transparent" },
  },
};

/** 页内不再需要月份标题 / 星期名（星期行固定在列表外） */
function EmptyHeader(): null {
  return null;
}

export const CalendarListView = memo(function CalendarListView({
  initialMonth,
  pastScrollRange,
  futureScrollRange,
  markedDates,
  onDayPress,
  onMonthChange,
  calendarWidth,
  listRef,
}: CalendarListViewProps): JSX.Element {
  const { t } = useTranslation();
  const accent = useThemeColor("accent");
  const accentForeground = useThemeColor("accent-foreground");

  const dayTheme = useMemo<CalendarDayTheme>(
    () => ({
      accent,
      accentForeground,
      dayLabel: (day) => t("calendar.dayLabel", { day }),
    }),
    [accent, accentForeground, t]
  );

  const handleMonthChange = useCallback(
    (data: DateData): void => onMonthChange({ year: data.year, month: data.month }),
    [onMonthChange]
  );

  return (
    <View>
      <CalendarWeekHeader />
      <CalendarDayContext.Provider value={dayTheme}>
        <CalendarList
          ref={listRef as never}
          style={{ height: CALENDAR_PAGE_HEIGHT, backgroundColor: "transparent" }}
          calendarWidth={calendarWidth}
          calendarHeight={CALENDAR_PAGE_HEIGHT}
          calendarStyle={{ paddingLeft: 0, paddingRight: 0 }}
          pastScrollRange={pastScrollRange}
          futureScrollRange={futureScrollRange}
          current={initialMonth}
          firstDay={0}
          hideExtraDays
          pagingEnabled
          animateScroll={false}
          showScrollIndicator={false}
          theme={THEME}
          markedDates={markedDates}
          dayComponent={CalendarDay as never}
          customHeader={EmptyHeader}
          onDayPress={onDayPress}
          onMonthChange={handleMonthChange}
        />
      </CalendarDayContext.Provider>
    </View>
  );
});
