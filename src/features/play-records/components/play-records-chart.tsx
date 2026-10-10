/**
 * 游玩记录 · 图表视图。
 *
 * 上面四块统计（总时长 / 次数 / 平均每次 / 最长一次，全时段），下面是
 * **按月、按周次**的时长条形图，顶部可切换年月。
 *
 * 条形是手绘的（与「收藏统计」的厂商横条同一思路）：
 *   - 不用 chart-kit 的默认外观，配色、圆角、间距全部由主题 token 与 uniwind 控制
 *   - 「今天所在的那一周」满色高亮，其余周半透明，一眼看到本周进度
 *   - 周次按**实际月长**切分（28 天的月只有 4 周，不会出现空柱）
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/icon";
import { Body, H5, Muted } from "@/components/typo";
import { StatBlock } from "@/components/ui";
import { useTranslation } from "@/hooks/use-translation";
import type { PlaySession } from "@/lib/db/dao/play-session";
import { withAlpha } from "@/theme/color";

import { formatPlayDuration, formatPlayDurationShort, formatYearMonth } from "../format";
import {
  currentWeekIndex,
  currentYearMonth,
  monthSessionCount,
  monthTotalMs,
  summarizeSessions,
  weeklyBuckets,
  type WeeklyBucket,
} from "../play-stats";

/** 柱体可用高度（pt）与柱宽 */
const BAR_AREA_HEIGHT = 112;
const BAR_WIDTH = 24;

export function PlayRecordsChart({ sessions }: { sessions: PlaySession[] }): JSX.Element {
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const { t } = useTranslation();
  // 懒初始化当前年月；切换时前后各一个月
  const [ym, setYm] = useState(currentYearMonth);

  const stats = summarizeSessions(sessions);
  const buckets = weeklyBuckets(sessions, ym.year, ym.month);
  const monthTotal = monthTotalMs(sessions, ym.year, ym.month);
  const monthCount = monthSessionCount(sessions, ym.year, ym.month);
  const maxMs = Math.max(...buckets.map((bucket) => bucket.ms), 1);
  const todayIndex = currentWeekIndex(ym.year, ym.month);

  const shiftMonth = (delta: number): void => {
    setYm((prev) => {
      const total = prev.year * 12 + prev.month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row gap-2 px-4 py-4">
        <StatBlock
          value={formatPlayDurationShort(stats.totalMs)}
          label={t("records.chart.total")}
          tone="accent"
        />
        <StatBlock value={String(stats.count)} label={t("records.chart.sessions")} />
        <StatBlock
          value={formatPlayDurationShort(stats.averageMs)}
          label={t("records.chart.average")}
        />
        <StatBlock
          value={formatPlayDurationShort(stats.longestMs)}
          label={t("records.chart.longest")}
        />
      </View>

      <View className="mx-4 gap-4 rounded-xl bg-default-soft p-4">
        <View className="flex-row items-center justify-between">
          <MonthButton
            label={t("records.chart.previousMonth")}
            icon="chevronLeft"
            onPress={() => shiftMonth(-1)}
          />
          <H5>{formatYearMonth(ym.year, ym.month)}</H5>
          <MonthButton
            label={t("records.chart.nextMonth")}
            icon="chevronRight"
            onPress={() => shiftMonth(1)}
          />
        </View>

        <Muted type="body-xs">
          {monthCount > 0
            ? t("records.chart.monthSummary", {
                duration: formatPlayDuration(monthTotal),
                count: monthCount,
              })
            : t("records.chart.monthEmpty")}
        </Muted>

        <View className="flex-row items-end gap-2">
          {buckets.map((bucket) => (
            <WeekBar
              key={bucket.key}
              bucket={bucket}
              maxMs={maxMs}
              accent={accent}
              muted={muted}
              today={bucket.index === todayIndex}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** 一周的竖条：上方读数、中间柱体、下方日期范围 */
function WeekBar({
  bucket,
  maxMs,
  accent,
  muted,
  today,
}: {
  bucket: WeeklyBucket;
  maxMs: number;
  accent: string;
  /** 主题 muted（父层取一次传下来，避免每根柱都挂订阅） */
  muted: string;
  today: boolean;
}): JSX.Element {
  const has = bucket.ms > 0;
  // 有数据最短也给 6pt，否则细到看不见；空周留 2pt 的基线
  const height = has ? Math.max(6, Math.round((bucket.ms / maxMs) * BAR_AREA_HEIGHT)) : 2;

  return (
    <View className="flex-1 items-center gap-1.5">
      <Body type="body-xs" className={`h-4 ${today ? "text-accent" : "text-muted"}`}>
        {has ? formatPlayDurationShort(bucket.ms) : " "}
      </Body>
      <View style={{ height: BAR_AREA_HEIGHT, width: "100%" }} className="justify-end">
        <View
          className={`self-center rounded-md ${has ? "" : "opacity-40"}`}
          style={{
            width: BAR_WIDTH,
            height,
            backgroundColor: has ? withAlpha(accent, today ? 1 : 0.4) : withAlpha(muted, 0.3),
          }}
        />
      </View>
      <Body type="body-xs" className={`text-[10px] ${today ? "text-accent" : "text-muted"}`}>
        {bucket.range}
      </Body>
    </View>
  );
}

/** 年月的左右切换按钮 */
function MonthButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: "chevronLeft" | "chevronRight";
  onPress: () => void;
}): JSX.Element {
  const muted = useThemeColor("muted");
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full bg-background active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={muted} />
    </Pressable>
  );
}
