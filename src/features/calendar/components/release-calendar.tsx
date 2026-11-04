import { Button, Card } from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { ErrorState, LoadingState } from "@/components/screen-state";
import { H5, Muted } from "@/components/typo";
import { useMonthReleases } from "@/features/calendar/hooks";
import {
  clampMonth,
  currentMonth,
  groupByDay,
  monthKey,
  type MonthRef,
} from "@/features/calendar/lib/calendar";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { isValidDate } from "@/utils/date";
import { formatMonthDay, todayIso } from "@/utils/format";

import { CalendarListView, type CalendarDate, type CalendarMarkedDates } from "./calendar-list";
import { CalendarRow } from "./calendar-row";
import { JumpDialog } from "./jump-dialog";

export function ReleaseCalendar() {
  const { t } = useTranslation();
  const surface = useTranslucentSurface();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWide = screenWidth >= 700 || (screenWidth > screenHeight && screenWidth >= 600);
  const [month, setMonth] = useState<MonthRef>(currentMonth);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const query = useMonthReleases(month);
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isError } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage().catch(() => undefined);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isError]);

  const groups = useMemo(
    () => groupByDay((query.data?.pages ?? []).flatMap((page) => page.results)),
    [query.data]
  );
  const key = monthKey(month);
  const activeDay = selectedDay?.startsWith(`${key}-`) ? selectedDay : null;
  const items = groups.find((group) => group.day === activeDay)?.items ?? [];
  const marks = useMemo<CalendarMarkedDates>(() => {
    const result: CalendarMarkedDates = {};
    for (const group of groups) result[group.day] = { marked: true };
    if (selectedDay) result[selectedDay] = { ...result[selectedDay], selected: true };
    return result;
  }, [groups, selectedDay]);

  const changeMonth = useCallback((next: MonthRef) => setMonth(next), []);
  const pickDay = useCallback((day: CalendarDate) => setSelectedDay(day.dateString), []);
  const goToMonth = (next: MonthRef) => {
    const target = clampMonth(next);
    setMonth(target);
  };
  const openJump = () => {
    const today = todayIso();
    setJumpDate(activeDay ?? (today.startsWith(`${key}-`) ? today : `${key}-01`));
    setJumpOpen(true);
  };
  const applyJump = () => {
    if (!isValidDate(jumpDate)) return;
    const [year, monthNumber] = jumpDate.split("-").map(Number);
    if (!year || !monthNumber) return;
    const target = { year, month: monthNumber };
    setSelectedDay(monthKey(clampMonth(target)) === monthKey(target) ? jumpDate : null);
    goToMonth(target);
    setJumpOpen(false);
  };

  return (
    <Card className="mx-4 my-3" style={surface}>
      <Card.Body>
        <H5>{t("calendar.title")}</H5>
        <View className="w-full self-center" style={{ maxWidth: isWide ? 920 : 560 }}>
          <View className="flex-row justify-end">
            <Button size="sm" variant="ghost" onPress={openJump}>
              <Button.Label>{t("calendar.jump")}</Button.Label>
            </Button>
          </View>
          <View style={{ flexDirection: isWide ? "row" : "column" }}>
            <View style={{ width: isWide ? "50%" : "100%" }}>
              <CalendarListView
                month={month}
                markedDates={marks}
                onDayPress={pickDay}
                onMonthChange={changeMonth}
                compact={screenWidth > screenHeight}
              />
            </View>
            <View style={isWide ? { flex: 1, minWidth: 0 } : undefined}>
              {activeDay ? (
                <Muted type="body-xs" className="px-4 pb-1 pt-3 font-semibold">
                  {formatMonthDay(activeDay)}
                </Muted>
              ) : null}
              {query.isError ? (
                <ErrorState error={query.error} onRetry={() => void query.refetch()} />
              ) : null}
              {activeDay && !query.isError ? (
                query.isLoading ? (
                  <LoadingState label={t("calendar.loading")} className="py-8" />
                ) : items.length ? (
                  items.map((vn) => <CalendarRow key={vn.id} vn={vn} />)
                ) : (
                  <Muted type="body-sm" className="px-4 py-6">
                    {t("calendar.dayEmpty")}
                  </Muted>
                )
              ) : null}
            </View>
          </View>
        </View>
      </Card.Body>
      <JumpDialog
        isOpen={jumpOpen}
        value={jumpDate}
        onChange={setJumpDate}
        onClose={() => setJumpOpen(false)}
        onConfirm={applyJump}
      />
    </Card>
  );
}
