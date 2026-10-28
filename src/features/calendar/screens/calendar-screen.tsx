/**
 * 发售日历（`/calendar`）。
 *
 * ## 交互
 *
 * - 上半屏是**月历**（`react-native-calendars` 的 `CalendarList`，周日开头），
 *   有发售的日期带小圆点；**上下拖动**切月，相邻月份预先在列表里
 * - 切月**不会自动选中**某一天：今天描空心圆，只有用户点过的日期才是实心圆
 * - 右上角「跳转」可以输入任意年月日，跳过去并选中那一天
 * - 点某一天，下半屏才列出那天发售的作品；没点之前留空
 *
 * ## 数据
 *
 * `useMonthReleases` 按发售日升序分页拉整月；切月后自动把剩余页拉全（最多 5 页），
 * 日历与「当天列表」共用同一份缓存，点日期时直接筛选、不再等分页。
 *
 * 只显示**精确到日**的发售；整月 / 整年 / TBA 的作品不进日历。
 */

import type { FlashListRef } from "@shopify/flash-list";
import { Button } from "heroui-native";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import type { DateData } from "react-native-calendars";

import { BackBar } from "@/components/back-bar";
import { Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import { isValidDate } from "@/utils/date";
import { todayIso } from "@/utils/format";

import {
  CalendarListView,
  type CalendarListHandle,
  type CalendarMarkedDates,
} from "@/features/calendar/components/calendar-list";
import { CalendarMonthList } from "@/features/calendar/components/calendar-month-list";
import { JumpDialog } from "@/features/calendar/components/jump-dialog";
import { useMonthReleases } from "@/features/calendar/hooks";
import {
  addMonths,
  clampMonth,
  currentMonth,
  groupByDay,
  monthKey,
  monthsAfterMonth,
  monthsBeforeMonth,
  type MonthRef,
} from "@/features/calendar/lib/calendar";

export default function CalendarScreen(): JSX.Element {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState<MonthRef>(() => currentMonth());
  /** 列表挂载时的月份：之后用户怎么滚都不回写 `current`，否则会把列表拽回去 */
  const [initial] = useState<MonthRef>(() => month);
  const initialMonth = `${monthKey(initial)}-01`;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState("");
  const calendarRef = useRef<CalendarListHandle>(null);
  const listRef = useRef<FlashListRef<VnSummary>>(null);
  const query = useMonthReleases(month);
  /** 左右各预取一个月（只第一页）：滑到相邻月份时圆点已经在了 */
  const prevQuery = useMonthReleases(clampMonth(addMonths(month, -1)));
  const nextQuery = useMonthReleases(clampMonth(addMonths(month, 1)));
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isError } = query;

  /**
   * 切月后把整月拉全（最多 `MAX_PAGES` 页）：用户点某一天时直接筛选，
   * 不需要手动「加载更多」，也不会出现「那天有作品但还没拉到」。
   */
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isError) return;
    // 失败会写进 query 状态（列表里给「重试」），这里只吞掉 promise 拒绝，避免红屏
    void fetchNextPage().catch(() => undefined);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isError]);

  const items = useMemo<VnSummary[]>(
    () => (query.data?.pages ?? []).flatMap((page) => page.results),
    [query.data]
  );
  const byDay = useMemo(() => groupByDay(items), [items]);
  const dayMap = useMemo(() => new Map(byDay.map((group) => [group.day, group.items])), [byDay]);

  const key = monthKey(month);
  /** 只有用户点过的日期才高亮；切月不会自动选一天 */
  const activeDay = selectedDay?.startsWith(`${key}-`) === true ? selectedDay : null;

  /** 只列用户点中的那一天；没选就是空列表（下方留空） */
  const dayItems = useMemo(
    () => (activeDay ? (dayMap.get(activeDay) ?? []) : []),
    [activeDay, dayMap]
  );
  /** 整月还在拉第一页时转圈；后面的页不再挡着空态，避免「这天没发售却一直加载」 */
  const monthLoading = query.isLoading;

  /** 日历上的小圆点（有发售）与选中态：当前月 + 左右各一个月 */
  const markedDates = useMemo<CalendarMarkedDates>(() => {
    const marks: CalendarMarkedDates = {};
    for (const group of byDay) marks[group.day] = { marked: true };
    for (const data of [prevQuery.data, nextQuery.data]) {
      for (const page of data?.pages ?? []) {
        for (const group of groupByDay(page.results)) marks[group.day] = { marked: true };
      }
    }
    if (selectedDay) marks[selectedDay] = { ...marks[selectedDay], selected: true };
    return marks;
  }, [byDay, prevQuery.data, nextQuery.data, selectedDay]);

  /** 换月或改选日期后回到列表顶部（不然会停在上个月/上一天的位置） */
  const resetList = useCallback((): void => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  /** 日历 / 读屏 / 跳转都会改月份：用 ref 去重，回调本身保持稳定 */
  const monthRef = useRef(month);
  useEffect(() => {
    monthRef.current = month;
  }, [month]);

  const changeMonth = useCallback(
    (next: MonthRef): void => {
      if (monthKey(monthRef.current) === monthKey(next)) return;
      monthRef.current = next;
      setMonth(next);
      resetList();
    },
    [resetList]
  );

  const pickDay = useCallback(
    (day: DateData): void => {
      setSelectedDay(day.dateString);
      resetList();
    },
    [resetList]
  );

  const shiftMonth = (delta: number): void => {
    const next = clampMonth(addMonths(month, delta));
    calendarRef.current?.scrollToMonth(`${monthKey(next)}-01`);
    changeMonth(next);
  };

  const openJump = (): void => {
    const today = todayIso();
    // 没选日期时给个合理的起点：本月就今天，不是本月就 1 号
    setJumpDate(activeDay ?? (today.startsWith(`${key}-`) ? today : `${key}-01`));
    setJumpOpen(true);
  };

  const applyJump = (): void => {
    if (!isValidDate(jumpDate)) return;
    const [year, monthNumber, day] = jumpDate.split("-").map(Number);
    if (!year || !monthNumber || !day) return;
    const base = { year, month: monthNumber };
    const target = clampMonth(base);
    // 超出 1950–2100 就只翻到边界，别选中一个日历里没有的日子
    if (monthKey(target) === monthKey(base)) {
      setSelectedDay(jumpDate);
    } else {
      setSelectedDay(null);
    }
    calendarRef.current?.scrollToMonth(`${monthKey(target)}-01`);
    changeMonth(target);
    resetList();
    setJumpOpen(false);
  };

  return (
    <View className="flex-1">
      <BackBar title={t("calendar.title")} />

      {/* 月份标题 + 跳转；切月靠上下拖动，不放左右箭头 */}
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Paragraph className="font-semibold">
          {t("calendar.monthTitle", { year: month.year, month: month.month })}
        </Paragraph>
        <Button size="sm" variant="ghost" onPress={openJump}>
          <Button.Label>{t("calendar.jump")}</Button.Label>
        </Button>
      </View>

      <View
        style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}
        className="px-4"
        accessibilityActions={[
          { name: "increment", label: t("calendar.nextMonth") },
          { name: "decrement", label: t("calendar.prevMonth") },
        ]}
        onAccessibilityAction={(event) => {
          shiftMonth(event.nativeEvent.actionName === "increment" ? 1 : -1);
        }}
      >
        <CalendarListView
          initialMonth={initialMonth}
          pastScrollRange={monthsBeforeMonth(initial)}
          futureScrollRange={monthsAfterMonth(initial)}
          calendarWidth={Math.min(width, 560) - 32}
          markedDates={markedDates}
          onDayPress={pickDay}
          onMonthChange={changeMonth}
          listRef={calendarRef}
        />
      </View>

      <CalendarMonthList
        items={dayItems}
        activeDay={activeDay}
        isLoading={monthLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        listRef={listRef}
      />

      <JumpDialog
        isOpen={jumpOpen}
        value={jumpDate}
        onChange={setJumpDate}
        onClose={() => setJumpOpen(false)}
        onConfirm={applyJump}
      />
    </View>
  );
}
