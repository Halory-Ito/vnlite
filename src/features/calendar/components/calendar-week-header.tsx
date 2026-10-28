/**
 * 日历顶部的一周星期名（固定在翻页器上方，不随月份页滚动）。
 *
 * `react-native-calendars` 默认把月份标题和星期名一起塞进每页的 header；
 * 这里改成列表外固定的一行，月份标题在页面外面（右上角还有「跳转」）。
 */

import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { WEEK_HEADER_HEIGHT } from "./calendar-layout";

/** 固定 key：英文缩写里 T / S 会重复，不能拿 label 当 key */
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function CalendarWeekHeader(): JSX.Element {
  const { t } = useTranslation();
  const labels = t("calendar.weekdays").split(",");

  return (
    <View className="flex-row" style={{ height: WEEK_HEADER_HEIGHT }}>
      {WEEKDAY_KEYS.map((key, index) => (
        <View key={key} style={{ width: `${100 / 7}%` }} className="items-center justify-center">
          <Muted type="body-xs" className="text-[10px] opacity-70">
            {labels[index] ?? ""}
          </Muted>
        </View>
      ))}
    </View>
  );
}
