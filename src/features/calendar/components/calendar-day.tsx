/**
 * 日历里的一天（`react-native-calendars` 的自定义 `dayComponent`）。
 *
 * - 今天：空心圆
 * - 选中：主题色实心圆（数字用前景色）
 * - 今天且选中：实心圆 + 外圈
 * - 有发售：圆点
 *
 * 尺寸 / 圆角都显式写在 `style` 里，不依赖 class 编译结果；
 * 主题色与文案从 Context 拿，避免每个格子各订阅一次。
 */

import type { JSX } from "react";
import { memo } from "react";
import { Pressable, View } from "react-native";
import type { DateData } from "react-native-calendars";

import { Paragraph } from "@/components/typo";
import { withAlpha } from "@/theme/color";
import { todayIso } from "@/utils/format";

import { useCalendarDayTheme } from "./calendar-day-context";
import { DAY_CELL_HEIGHT } from "./calendar-layout";

const CIRCLE_SIZE = 36;
const RING_SIZE = 40;

/** `markedDates` 里我们用到的字段 */
interface DayMarking {
  marked?: boolean;
  selected?: boolean;
}

interface CalendarDayProps {
  date?: DateData;
  marking?: DayMarking;
  onPress?: (date?: DateData) => void;
}

export const CalendarDay = memo(
  function CalendarDay({ date, marking, onPress }: CalendarDayProps): JSX.Element | null {
    const { accent, accentForeground, dayLabel } = useCalendarDayTheme();

    if (!date) return null;

    const selected = marking?.selected === true;
    const marked = marking?.marked === true;
    const isToday = date.dateString === todayIso();

    return (
      <Pressable
        onPress={() => onPress?.(date)}
        className="active:opacity-60"
        style={{
          height: DAY_CELL_HEIGHT,
          alignSelf: "stretch",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={dayLabel(date.day)}
      >
        <View
          className="items-center justify-center"
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            ...(isToday ? { borderWidth: 1, borderColor: withAlpha(accent, 0.65) } : null),
          }}
        >
          <View
            className="items-center justify-center"
            style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
              backgroundColor: selected ? accent : "transparent",
            }}
          >
            <Paragraph
              className="text-[13px]"
              style={{ color: selected ? accentForeground : isToday ? accent : undefined }}
              selectable={false}
            >
              {date.day}
            </Paragraph>
          </View>
        </View>
        {/* 有发售的日子点一个小圆点 */}
        <View
          style={{
            marginTop: 2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: marked ? accent : "transparent",
            opacity: selected ? 0 : 1,
          }}
        />
      </Pressable>
    );
  },
  /**
   * 库每次渲染都会给新的 `date` 对象；只比真正会变的东西，
   * 避免加载分页 / 选中别的日期时把 42 个格子全重渲染。
   */
  (prev, next) =>
    prev.date?.dateString === next.date?.dateString &&
    prev.marking?.marked === next.marking?.marked &&
    prev.marking?.selected === next.marking?.selected &&
    prev.onPress === next.onPress
);
