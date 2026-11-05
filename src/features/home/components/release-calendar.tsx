import { Card, Typography, useThemeColor } from "heroui-native";
import { useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Icon } from "@/components/icon";
import { H5 } from "@/components/typo";
import { ReleaseCalendarJump } from "./release-calendar-jump";
import { Muted } from "@/components/typo";
import { ReleaseCalendarList } from "./release-calendar-list";
import { useVnList, flattenPages } from "@/features/vn/hooks";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";

const WEEK = [0, 1, 2, 3, 4, 5, 6];
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthStart = (year: number, month: number) => new Date(year, month, 1);

export function ReleaseCalendar() {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const surface = useTranslucentSurface();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentForeground = useThemeColor("accent-foreground");
  const foreground = useThemeColor("foreground");
  const [initialDate] = useState(() => new Date());
  const todayIso = iso(initialDate);
  const [month, setMonth] = useState(() =>
    monthStart(initialDate.getFullYear(), initialDate.getMonth())
  );
  const [selected, setSelected] = useState(() => iso(initialDate));
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState(iso(initialDate));
  const first = monthStart(month.getFullYear(), month.getMonth());
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = first.getDay();
  const cells = useMemo(
    () => Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1),
    [offset, days]
  );
  const monthRange = useVnList({
    filters: {
      releasedFrom: iso(monthStart(month.getFullYear(), month.getMonth())),
      releasedTo: iso(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
    },
    sort: "released",
    pageSize: 100,
  });
  const releaseDays = useMemo(
    () => new Set(flattenPages(monthRange.data?.pages).map((vn) => vn.released)),
    [monthRange.data]
  );
  const compact = width < 700;
  const shiftMonth = (delta: number) =>
    setMonth((value) => monthStart(value.getFullYear(), value.getMonth() + delta));
  const choose = (day: number) => {
    if (day > 0 && day <= days)
      setSelected(iso(new Date(month.getFullYear(), month.getMonth(), day)));
  };
  const jumpToDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jumpDate)) return;
    const date = new Date(`${jumpDate}T00:00:00`);
    if (!Number.isFinite(date.getTime()) || iso(date) !== jumpDate) return;
    setSelected(jumpDate);
    setMonth(monthStart(date.getFullYear(), date.getMonth()));
    setJumpOpen(false);
  };
  return (
    <Card className="mx-4 my-3" style={surface}>
      <Card.Body className="gap-3">
        <View className={compact ? "gap-4" : "flex-row gap-5"}>
          <View className={compact ? "" : "flex-1"}>
            <View
              className={`mb-3 gap-2 ${compact ? "" : "flex-row items-center justify-between"}`}
            >
              <H5>{t("home.releaseCalendar")}</H5>
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => shiftMonth(-1)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.previousMonth")}
                  className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
                >
                  <Icon name="chevronLeft" size={20} color={muted} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setJumpDate(selected);
                    setJumpOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.jumpToDate")}
                  className="flex-row items-center gap-2 rounded-md px-2 py-1 active:opacity-60"
                >
                  <Typography type={compact ? "body-sm" : "h5"} className="font-semibold">
                    {new Date(`${selected}T00:00:00`).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Typography>
                  <Icon name="calendar" size={18} color={muted} />
                </Pressable>
                <Pressable
                  onPress={() => shiftMonth(1)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.nextMonth")}
                  className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
                >
                  <Icon name="chevronRight" size={20} color={muted} />
                </Pressable>
              </View>
            </View>
            <View className="mb-2 flex-row border-b border-border pb-2">
              {WEEK.map((day) => (
                <Muted key={day} type="body-xs" className="flex-1 text-center">
                  {t(
                    (
                      [
                        "home.weekdaySun",
                        "home.weekdayMon",
                        "home.weekdayTue",
                        "home.weekdayWed",
                        "home.weekdayThu",
                        "home.weekdayFri",
                        "home.weekdaySat",
                      ] as const
                    )[day]
                  )}
                </Muted>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {cells.map((day, index) => {
                const date =
                  day > 0 && day <= days
                    ? iso(new Date(month.getFullYear(), month.getMonth(), day))
                    : "";
                const active = date === selected;
                const today = date === todayIso;
                return (
                  <Pressable
                    key={date || `blank-${index}`}
                    onPress={() => choose(day)}
                    disabled={!date}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className="w-[14.285%] items-center py-2"
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        minWidth: 36,
                        minHeight: 36,
                        borderRadius: 999,
                        borderWidth: today && !active ? 1.5 : 0,
                        borderColor: accent,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? accent : "transparent",
                        overflow: "hidden",
                      }}
                    >
                      <Typography
                        type="body-sm"
                        style={{ color: active ? accentForeground : date ? foreground : muted }}
                      >
                        {day > 0 && day <= days ? day : ""}
                      </Typography>
                    </View>
                    <View className="mt-1 h-1.5 w-1.5">
                      {date && releaseDays.has(date) ? (
                        <View
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className={compact ? "" : "flex-1"}>
            <ReleaseCalendarList key={selected} date={selected} />
          </View>
        </View>
      </Card.Body>
      <ReleaseCalendarJump
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        date={jumpDate}
        onDateChange={setJumpDate}
        onConfirm={jumpToDate}
      />
    </Card>
  );
}
