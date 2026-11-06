import { Button, Typography, useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { H5 } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

interface Props {
  month: Date;
  showToday: boolean;
  onToday: () => void;
  onShiftMonth: (delta: number) => void;
  onJump: () => void;
}

export function ReleaseCalendarHeader({ month, showToday, onToday, onShiftMonth, onJump }: Props) {
  const { t, locale } = useTranslation();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  return (
    <View className="mb-3 gap-3">
      <View className="min-h-11 flex-row items-center justify-between gap-2">
        <H5 className="shrink">{t("home.releaseCalendar")}</H5>
        {showToday ? (
          <Button size="sm" variant="ghost" onPress={onToday}>
            <Button.Label>{t("home.backToToday")}</Button.Label>
          </Button>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => onShiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel={t("home.previousMonth")}
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
        >
          <Icon name="chevronLeft" size={20} color={muted} />
        </Pressable>
        <Pressable
          onPress={onJump}
          accessibilityRole="button"
          accessibilityLabel={t("home.jumpToDate")}
          className="min-h-11 min-w-0 shrink flex-row items-center justify-center gap-2 rounded-xl bg-accent-soft px-4 py-2 active:opacity-60"
        >
          <Typography
            type="h5"
            className="shrink text-center font-bold text-accent-soft-foreground"
          >
            {month.toLocaleDateString(locale, { year: "numeric", month: "long" })}
          </Typography>
          <Icon name="calendar" size={20} color={accent} />
        </Pressable>
        <Pressable
          onPress={() => onShiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel={t("home.nextMonth")}
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
        >
          <Icon name="chevronRight" size={20} color={muted} />
        </Pressable>
      </View>
    </View>
  );
}
