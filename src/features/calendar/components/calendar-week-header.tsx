/**
 * 月历顶部的星期名。
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
    <View
      className="mb-1 flex-row border-b border-separator pb-2"
      style={{ height: WEEK_HEADER_HEIGHT + 8 }}
    >
      {WEEKDAY_KEYS.map((key, index) => (
        <View key={key} className="flex-1 items-center justify-center">
          <Muted type="body-xs" className="text-xs font-semibold">
            {labels[index] ?? ""}
          </Muted>
        </View>
      ))}
    </View>
  );
}
