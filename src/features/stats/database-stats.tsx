/**
 * VNDB 数据库统计（`GET /stats`）—— 首页底部的全局条目占比扇形图。
 *
 * 数据是**整个 VNDB 站点**的累计条目数（收藏统计读的是你自己的清单，
 * 两者数据源不同，别混）。
 *
 * 用 chart-kit v2 的 `PieChart`（`react-native-chart-kit/v2`），交互走
 * **Tap Selection**：点扇区即选中（其余扇区淡出、选中块弹出），
 * 下方读数行给出该类别的**精确条目数 + 占比**（图例只有百分比）。
 *
 * 颜色走主题：第一块用 accent，其余固定色板（与收藏统计页同一套）；
 * 背景 / 文字都从主题 token 注入，换主题跟着变。
 */

import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { PieChart } from "react-native-chart-kit/v2";

import { H5, Muted } from "@/components/typo";
import { getStats } from "@/lib/api/endpoints/ulist";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { formatCount } from "@/utils/format";

/** `/stats` 的返回结构 */
type StatsResponse = Awaited<ReturnType<typeof getStats>>;

/** 类别展示顺序：按 vndb.org 的习惯排（不按数量），刷新时扇区顺序不会跳动 */
const CATEGORIES = [
  { key: "vn", label: "视觉小说" },
  { key: "releases", label: "发行版" },
  { key: "chars", label: "角色" },
  { key: "staff", label: "制作人员" },
  { key: "producers", label: "制作者" },
  { key: "tags", label: "标签" },
  { key: "traits", label: "特性" },
] as const satisfies readonly { key: keyof StatsResponse; label: string }[];

/** 扇形色板：第一块用主题 accent，其余固定（语义色不随主题乱变） */
const SLICE_PALETTE = ["#2d9cdb", "#27ae60", "#f2994a", "#9b51e0", "#eb5757", "#56ccf2"];

/** 图表整体高度；下半部分留给图例（7 项会折成 4 行），别把图例挤没 */
const CHART_HEIGHT = 320;
/** 图例预留高度（7 项 × 约 2 列） */
const LEGEND_HEIGHT = 120;

export function DatabaseStats(): JSX.Element {
  const stats = useQuery({
    queryKey: queryKeys.database.stats(),
    queryFn: ({ signal }) => getStats(signal),
    // 数据库条目数变化很慢，放一小时足够新鲜
    staleTime: STALE_TIME.taxonomy,
  });

  return (
    <Card className="mx-4 my-3">
      <Card.Body className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <H5>数据库统计</H5>
          <Muted type="body-xs">vndb.org</Muted>
        </View>

        {stats.isLoading ? <StatsSkeleton /> : null}
        {stats.isError ? <Muted type="body-sm">统计加载失败，稍后再试</Muted> : null}
        {stats.data ? <StatsPie data={stats.data} /> : null}
      </Card.Body>
    </Card>
  );
}

/** 扇形图 + 点选读数 */
function StatsPie({ data }: { data: StatsResponse }): JSX.Element {
  const { width } = useWindowDimensions();
  const accent = useThemeColor("accent");
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  // 受控选中：undefined = 没选。读数行靠它显示具体数字
  const [selected, setSelected] = useState<number | undefined>(undefined);

  const rows = CATEGORIES.map((category) => ({
    name: category.label,
    value: data[category.key],
  }));
  const series = [accent, ...SLICE_PALETTE];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const active = selected != null ? rows[selected] : undefined;

  return (
    <View>
      <PieChart
        // 卡片左右各 16pt（`mx-4`）内边距，图表的可用宽度
        width={width - 32}
        height={CHART_HEIGHT}
        data={rows}
        labelKey="name"
        valueKey="value"
        legend={{ reservedHeight: LEGEND_HEIGHT }}
        // 点扇区选中：其余淡出 + 选中块弹出（activeOffset 用默认值）
        interaction={{
          mode: "tap",
          onSelect: (event) => setSelected(event.index),
          onDeselect: () => setSelected(undefined),
        }}
        selectedIndex={selected}
        activeSlice={{ inactiveOpacity: 0.36 }}
        // 计数用 `67k` 缩写；外置标签关掉后它只作用于无障碍摘要
        formatValue={(value) => formatCount(value)}
        theme={{
          background: "transparent",
          plotBackground: "transparent",
          text: foreground,
          mutedText: muted,
          series,
        }}
      />

      {/* 读数行：未选中给操作提示，选中后给精确条目数 + 占比（图例只有百分比） */}
      <View className="h-6 flex-row items-center justify-center gap-2">
        {active && selected != null ? (
          <>
            <View
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: series[selected % series.length] }}
            />
            <Muted type="body-xs">{active.name}</Muted>
            <Muted type="body-xs" className="font-semibold">
              {formatCount(active.value)} 条
            </Muted>
            <Muted type="body-xs" className="opacity-60">
              {total > 0 ? `${Math.round((active.value / total) * 100)}%` : "—"}
            </Muted>
          </>
        ) : (
          <Muted type="body-xs" className="opacity-70">
            点按扇区查看条目数
          </Muted>
        )}
      </View>
    </View>
  );
}

/** 骨架屏：结构与扇形图对齐（一个圆 + 两行标签 + 读数行） */
function StatsSkeleton(): JSX.Element {
  return (
    <View className="items-center gap-4 py-4">
      <Skeleton variant="pulse" className="h-40 w-40 rounded-full" />
      <View className="flex-row gap-3">
        <Skeleton variant="pulse" className="h-3 w-16 rounded-md" />
        <Skeleton variant="pulse" className="h-3 w-16 rounded-md" />
      </View>
    </View>
  );
}
