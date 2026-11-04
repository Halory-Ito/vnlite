import type { JSX } from "react";
import { memo } from "react";
import { Pressable, View } from "react-native";
import type { CalendarDate } from "./calendar-list";

import { Paragraph } from "@/components/typo";
import { withAlpha } from "@/theme/color";
import { todayIso } from "@/utils/format";

import { useCalendarDayTheme } from "./calendar-day-context";
import { DAY_CELL_HEIGHT } from "./calendar-layout";

const CIRCLE_SIZE = 36;
const RING_SIZE = 40;
const DOT_SIZE = 4;

interface DayMarking {
  marked?: boolean;
  selected?: boolean;
}

interface CalendarDayProps {
  date?: CalendarDate;
  marking?: DayMarking;
  onPress?: (date: CalendarDate) => void;
  compact?: boolean;
  outsideMonth?: boolean;
}

export const CalendarDay = memo(
  function CalendarDay({
    date,
    marking,
    onPress,
    compact = false,
    outsideMonth = false,
  }: CalendarDayProps): JSX.Element | null {
    const { accent, accentForeground, dayLabel, defaultColor } = useCalendarDayTheme();

    if (!date) return null;

    const selected = marking?.selected === true;
    const marked = marking?.marked === true;
    const isToday = date.dateString === todayIso();

    return (
      <Pressable
        onPress={() => onPress?.(date)}
        disabled={outsideMonth}
        className="active:opacity-60"
        style={{
          height: compact ? 42 : DAY_CELL_HEIGHT,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={dayLabel(date.day)}
        accessibilityElementsHidden={outsideMonth}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: compact ? 30 : RING_SIZE,
            height: compact ? 30 : RING_SIZE,
            borderRadius: 9999,
            ...(isToday ? { borderWidth: 1, borderColor: withAlpha(accent, 0.65) } : null),
          }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: compact ? 26 : CIRCLE_SIZE,
              height: compact ? 26 : CIRCLE_SIZE,
              borderRadius: 9999,
              backgroundColor: selected ? accent : "transparent",
            }}
          >
            <Paragraph
              className="text-[13px]"
              style={{
                color: selected ? accentForeground : isToday ? accent : defaultColor,
                opacity: outsideMonth ? 0.3 : 1,
              }}
              selectable={false}
            >
              {date.day}
            </Paragraph>
          </View>
        </View>
        <View
          style={{
            position: "absolute",
            bottom: compact ? 1 : 2,
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: 9999,
            backgroundColor: marked && !outsideMonth ? accent : "transparent",
            flexShrink: 0,
          }}
        />
      </Pressable>
    );
  },
  (prev, next) =>
    prev.date?.dateString === next.date?.dateString &&
    prev.marking?.marked === next.marking?.marked &&
    prev.marking?.selected === next.marking?.selected &&
    prev.compact === next.compact &&
    prev.outsideMonth === next.outsideMonth &&
    prev.onPress === next.onPress
);
