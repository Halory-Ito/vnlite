import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { memo, useMemo } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { Paragraph } from "@/components/typo";
import {
  addMonths,
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  daysInMonth,
  monthKey,
  type MonthRef,
} from "@/features/calendar/lib/calendar";
import { useTranslation } from "@/hooks/use-translation";

import { CalendarDay } from "./calendar-day";
import { CalendarDayContext, type CalendarDayTheme } from "./calendar-day-context";
import { CalendarWeekHeader } from "./calendar-week-header";

export type CalendarMarkedDates = Record<string, { marked?: boolean; selected?: boolean }>;
export interface CalendarDate {
  dateString: string;
  day: number;
  month: number;
  year: number;
}

interface CalendarListViewProps {
  month: MonthRef;
  markedDates: CalendarMarkedDates;
  onDayPress: (day: CalendarDate) => void;
  onMonthChange: (month: MonthRef) => void;
  compact?: boolean;
}

export const CalendarListView = memo(function CalendarListView({
  month,
  markedDates,
  onDayPress,
  onMonthChange,
  compact = false,
}: CalendarListViewProps): JSX.Element {
  const { t } = useTranslation();
  const foreground = useThemeColor("foreground");
  const accent = useThemeColor("accent");
  const accentForeground = useThemeColor("accent-foreground");
  const dayTheme = useMemo<CalendarDayTheme>(
    () => ({
      accent,
      accentForeground,
      defaultColor: foreground,
      dayLabel: (day) => t("calendar.dayLabel", { day }),
    }),
    [accent, accentForeground, foreground, t]
  );
  const firstWeekday = new Date(month.year, month.month - 1, 1).getDay();
  const count = daysInMonth(month);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    const date = new Date(month.year, month.month - 1, day);
    const dateString =
      String(date.getFullYear()) +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0");
    return {
      id: monthKey(month) + "-slot-" + String(index),
      date: {
        dateString,
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      },
      outsideMonth: day < 1 || day > count,
    };
  });
  const canGoBack = month.year > CALENDAR_MIN_YEAR || month.month > 1;
  const canGoForward = month.year < CALENDAR_MAX_YEAR || month.month < 12;

  const panGesture = useMemo(() => {
    // oxlint-disable-next-line react/capitalized-calls
    return Gesture.Pan()
      .activeOffsetX([-20, 20])
      .failOffsetY([-20, 20])
      .onEnd((event) => {
        if (event.translationX > 45 && canGoBack) {
          onMonthChange(addMonths(month, -1));
        } else if (event.translationX < -45 && canGoForward) {
          onMonthChange(addMonths(month, 1));
        }
      });
  }, [canGoBack, canGoForward, month, onMonthChange]);

  return (
    <View className="w-full">
      <View className="mb-2 flex-row items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          isDisabled={!canGoBack}
          accessibilityLabel={t("calendar.prevMonth")}
          onPress={() => onMonthChange(addMonths(month, -1))}
        >
          <Icon name="chevronLeft" color={foreground} />
        </Button>
        <Paragraph className="text-lg font-semibold" style={{ color: foreground }}>
          {t("calendar.monthTitle", { year: month.year, month: month.month })}
        </Paragraph>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          isDisabled={!canGoForward}
          accessibilityLabel={t("calendar.nextMonth")}
          onPress={() => onMonthChange(addMonths(month, 1))}
        >
          <Icon name="chevronRight" color={foreground} />
        </Button>
      </View>
      <CalendarWeekHeader />
      <GestureDetector gesture={panGesture}>
        <View collapsable={false}>
          <CalendarDayContext.Provider value={dayTheme}>
            <View>
              {Array.from({ length: 6 }, (_, week) => (
                <View key={monthKey(month) + "-week-" + String(week)} className="flex-row">
                  {cells.slice(week * 7, week * 7 + 7).map(({ id, date, outsideMonth }) => (
                    <View key={id} className="flex-1 items-center">
                      <CalendarDay
                        date={date}
                        marking={markedDates[date.dateString]}
                        compact={compact}
                        outsideMonth={outsideMonth}
                        onPress={onDayPress}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </CalendarDayContext.Provider>
        </View>
      </GestureDetector>
    </View>
  );
});
