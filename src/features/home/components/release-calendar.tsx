import { Card, Typography, useThemeColor } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, useWindowDimensions, View } from "react-native";

import { ReleaseCalendarHeader } from "./release-calendar-header";
import { isValidDate } from "@/utils/date";
import { COVER_GRID_TABLET_MIN_SHORT_SIDE } from "@/utils/grid";
import { ReleaseCalendarJump } from "./release-calendar-jump";
import { Muted } from "@/components/typo";
import { ReleaseCalendarList } from "./release-calendar-list";
import { useReleaseCalendarDays } from "@/features/home/hooks/use-release-calendar-days";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";

const WEEK = [0, 1, 2, 3, 4, 5, 6];
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthStart = (year: number, month: number) => new Date(year, month, 1);

export function ReleaseCalendar() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const surface = useTranslucentSurface();
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentForeground = useThemeColor("accent-foreground");
  const foreground = useThemeColor("foreground");
  const [initialDate] = useState(() => new Date());
  const [todayIso, setTodayIso] = useState(() => iso(initialDate));
  useEffect(() => {
    const refreshToday = () => setTodayIso(iso(new Date()));
    const timer = setInterval(refreshToday, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshToday();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const [month, setMonth] = useState(() =>
    monthStart(initialDate.getFullYear(), initialDate.getMonth())
  );
  const [selected, setSelected] = useState(() => iso(initialDate));
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const first = monthStart(month.getFullYear(), month.getMonth());
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = first.getDay();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) => i - offset + 1
  );
  const monthRange = useReleaseCalendarDays(
    iso(first),
    iso(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  );
  const releaseDays = useMemo(() => new Set(monthRange.data ?? []), [monthRange.data]);
  const compact = Math.min(width, height) < COVER_GRID_TABLET_MIN_SHORT_SIDE || contentWidth < 660;
  const shiftMonth = (delta: number) => {
    const next = monthStart(month.getFullYear(), month.getMonth() + delta);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const day = Math.min(Number(selected.slice(-2)), lastDay);
    setMonth(next);
    setSelected(iso(new Date(next.getFullYear(), next.getMonth(), day)));
  };
  const choose = (day: number) => {
    if (day > 0 && day <= days)
      setSelected(iso(new Date(month.getFullYear(), month.getMonth(), day)));
  };
  const jumpToDate = () => {
    if (!isValidDate(jumpDate)) return;
    const date = new Date(`${jumpDate}T00:00:00`);
    if (!Number.isFinite(date.getTime()) || iso(date) !== jumpDate) return;
    setSelected(jumpDate);
    setMonth(monthStart(date.getFullYear(), date.getMonth()));
    setJumpOpen(false);
  };
  return (
    <Card className="mx-4 my-3" style={surface}>
      <Card.Body className="gap-3">
        <View
          onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
          className={compact ? "gap-4" : "flex-row gap-5"}
        >
          <View className={compact ? "" : "flex-1"}>
            <ReleaseCalendarHeader
              month={month}
              showToday={selected !== todayIso || iso(first).slice(0, 7) !== todayIso.slice(0, 7)}
              onToday={() => {
                const today = new Date();
                setSelected(iso(today));
                setMonth(monthStart(today.getFullYear(), today.getMonth()));
              }}
              onShiftMonth={shiftMonth}
              onJump={() => {
                setJumpDate("");
                setJumpOpen(true);
              }}
            />
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
            <ReleaseCalendarList date={selected} compact={compact} />
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
