import { Button, useThemeColor } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/icon";
import { Body, H5, Muted } from "@/components/typo";
import { contributionWeeks } from "@/features/home/lib/heatmap-calendar";
import { dailyPlaySummary, heatLevel, localDayKey } from "@/features/home/lib/play-summary";
import { formatPlayDuration } from "@/features/play-records/lib/format";
import { useTranslation } from "@/hooks/use-translation";

const LEVELS = ["bg-default-soft", "bg-accent/20", "bg-accent/40", "bg-accent/70", "bg-accent"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function PlayHeatmap({
  days,
  now,
}: {
  days: ReturnType<typeof dailyPlaySummary>;
  now: Date;
}) {
  const { t, locale } = useTranslation();
  const color = useThemeColor("foreground");
  const [year, setYear] = useState(() => now.getFullYear());
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const weeks = useMemo(() => contributionWeeks(year), [year]);
  const cell = Math.min(16, Math.max(12, Math.floor(width / weeks.length) - 3));
  const weekdays = t("calendar.weekdays").split(",");
  const today = localDayKey(now);
  function move(amount: number) {
    setYear(year + amount);
    setSelected(null);
  }
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <H5>{t("home.playHeatmap")}</H5>
        <View className="flex-row items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={year <= 1900}
            onPress={() => move(-1)}
            accessibilityLabel={t("home.previousYear")}
          >
            <Icon name="chevronLeft" color={color} />
          </Button>
          <Body>{year}</Body>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={year >= now.getFullYear()}
            onPress={() => move(1)}
            accessibilityLabel={t("home.nextYear")}
          >
            <Icon name="chevronRight" color={color} />
          </Button>
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="pt-6">
          {WEEKDAYS.map((day, index) => (
            <View key={day} className="justify-center" style={{ height: cell + 3 }}>
              <Muted type="body-xs" className="text-[10px]">
                {index % 2 === 1 ? weekdays[index] : ""}
              </Muted>
            </View>
          ))}
        </View>
        <ScrollView
          key={year}
          horizontal
          className="flex-1"
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          showsHorizontalScrollIndicator={false}
        >
          <View className="flex-row">
            {weeks.map((week) => (
              <View key={week.key} style={{ width: cell + 3 }}>
                <View className="h-6 overflow-visible">
                  {week.month !== null ? (
                    <Muted
                      type="body-xs"
                      numberOfLines={1}
                      className="absolute text-[10px]"
                      style={{ width: (cell + 3) * 3.5 }}
                    >
                      {new Date(year, week.month, 1).toLocaleDateString(locale, { month: "short" })}
                    </Muted>
                  ) : null}
                </View>
                {week.days.map((date, index) => (
                  <View key={date ?? WEEKDAYS[index]} style={{ width: cell + 3, height: cell + 3 }}>
                    {date ? (
                      <Pressable
                        onPress={() => setSelected(date)}
                        disabled={date > today}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selected === date, disabled: date > today }}
                        accessibilityLabel={`${date}: ${formatPlayDuration(days.get(date)?.ms ?? 0)}`}
                        className={`rounded-sm ${LEVELS[heatLevel(days.get(date)?.ms ?? 0)]} ${date > today ? "opacity-30" : "active:opacity-60"} ${selected === date ? "border border-foreground" : ""}`}
                        style={{ width: cell, height: cell }}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <View className="flex-row items-center justify-end gap-1">
        <Muted type="body-xs">{t("home.lessPlay")}</Muted>
        {LEVELS.map((level) => (
          <View key={level} className={`h-3 w-3 rounded-sm ${level}`} />
        ))}
        <Muted type="body-xs">{t("home.morePlay")}</Muted>
      </View>
      {selected ? (
        <Body type="body-sm">
          {selected} · {formatPlayDuration(days.get(selected)?.ms ?? 0)}
        </Body>
      ) : null}
    </View>
  );
}
