/**
 * 「记录统计」页共用的图表外壳。
 *
 * - `Section`：统一的卡片标题 + 白底容器
 * - `PieSection`：chart-kit 饼图（第一块用主题 accent，其余固定色板）
 * - `VerticalBars`：手绘竖条（按月 / 按周时长），配色 / 圆角 / 间距全走主题
 * - `HorizontalBars`：手绘横条（游玩时长排名 / 厂商 Top，名字太长塞不进竖柱 X 轴）
 *
 * 配色一律取主题 token（`accent` / `muted`），换主题跟着变；
 * 数值格式化由调用方传 `formatValue`，这里不绑定具体业务。
 */

import { Card, useThemeColor } from "heroui-native";
import type { ComponentProps, JSX, ReactNode } from "react";
import { View } from "react-native";
import { PieChart } from "react-native-chart-kit";

import { Body, H5, Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import { withAlpha } from "@/theme/color";

/** chart-kit 的 chartConfig（它没导出类型，从组件 props 里取） */
export type ChartConfig = ComponentProps<typeof PieChart>["chartConfig"];

/** 饼图色板：第一块用主题 accent，其余固定（语义色不该随主题变） */
export const SLICE_PALETTE = [
  "#2d9cdb",
  "#27ae60",
  "#f2994a",
  "#9b51e0",
  "#eb5757",
  "#56ccf2",
] as const;

/** 图表卡片：统一的标题 + 白底容器 */
export function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <Card className="mx-4 my-2">
      <Card.Body className="gap-3">
        <H5>{title}</H5>
        <View className="items-center">{children}</View>
      </Card.Body>
    </Card>
  );
}

/** 空数据占位（统一文案由调用方给，个别图表语义不同） */
function EmptyNote({ text }: { text: string }): JSX.Element {
  return (
    <Muted type="body-xs" className="py-4">
      {text}
    </Muted>
  );
}

export interface PieBucket {
  name: string;
  value: number;
}

/** 饼图卡片：把 `{ name, value }` 聚合成 chart-kit 的饼图（第一块用主题 accent） */
export function PieSection({
  title,
  buckets,
  width,
  accent,
  muted,
  chartConfig,
  emptyText,
}: {
  title: string;
  buckets: readonly PieBucket[];
  width: number;
  accent: string;
  muted: string;
  chartConfig: ChartConfig;
  emptyText?: string;
}): JSX.Element {
  const { t } = useTranslation();
  if (buckets.length === 0) {
    return (
      <Section title={title}>
        <EmptyNote text={emptyText ?? t("stats.pieEmpty")} />
      </Section>
    );
  }

  return (
    <Section title={title}>
      <PieChart
        data={buckets.map((bucket, index) => ({
          name: bucket.name,
          value: bucket.value,
          color: index === 0 ? accent : (SLICE_PALETTE[index - 1] ?? accent),
          legendFontColor: muted,
          legendFontSize: 12,
        }))}
        width={width}
        height={Math.max(160, 40 * buckets.length)}
        chartConfig={chartConfig}
        accessor="value"
        backgroundColor="transparent"
        paddingLeft="0"
        absolute
        hasLegend
      />
    </Section>
  );
}

/** 竖条图的一根柱 */
export interface VerticalBarDatum {
  key: string;
  /** 柱底标签（月份 / 周日期范围） */
  label: string;
  value: number;
  /** 强调色高亮（当前月 / 本周） */
  highlight?: boolean;
}

/** 柱体可用高度（pt）与柱宽上限 */
const BAR_AREA_HEIGHT = 112;
const BAR_MAX_WIDTH = 24;

/**
 * 手绘竖条图。柱子用 `flex-1` 均分宽度（12 根月柱也不挤），
 * 数值在柱顶、标签在柱底；无数据的柱留 2pt 基线。
 */
export function VerticalBars({
  data,
  formatValue,
  accent,
  muted,
}: {
  data: readonly VerticalBarDatum[];
  formatValue: (value: number) => string;
  accent: string;
  muted: string;
}): JSX.Element {
  const max = Math.max(...data.map((datum) => datum.value), 1);

  return (
    <View className="w-full flex-row items-end gap-1">
      {data.map((datum) => {
        const has = datum.value > 0;
        const height = has ? Math.max(6, Math.round((datum.value / max) * BAR_AREA_HEIGHT)) : 2;
        return (
          <View key={datum.key} className="flex-1 items-center gap-1.5">
            <Body
              type="body-xs"
              className={`h-4 ${datum.highlight ? "text-accent" : "text-muted"}`}
            >
              {has ? formatValue(datum.value) : " "}
            </Body>
            <View style={{ height: BAR_AREA_HEIGHT }} className="w-full items-center justify-end">
              <View
                className={`rounded-md ${has ? "" : "opacity-40"}`}
                style={{
                  width: "100%",
                  maxWidth: BAR_MAX_WIDTH,
                  height,
                  backgroundColor: has
                    ? withAlpha(accent, datum.highlight ? 1 : 0.45)
                    : withAlpha(muted, 0.3),
                }}
              />
            </View>
            <Body
              type="body-xs"
              className={`text-[10px] ${datum.highlight ? "text-accent" : "text-muted"}`}
            >
              {datum.label}
            </Body>
          </View>
        );
      })}
    </View>
  );
}

/** 横条图的一行 */
export interface HorizontalBarDatum {
  key: string;
  name: string;
  value: number;
}

/** 手绘横向条（名字在左、数值在右、条长按最大值为基准） */
export function HorizontalBars({
  data,
  formatValue,
}: {
  data: readonly HorizontalBarDatum[];
  formatValue: (value: number) => string;
}): JSX.Element {
  const accent = useThemeColor("accent");
  const max = data[0]?.value ?? 1;

  return (
    <View className="w-full gap-2.5">
      {data.map((datum) => (
        <View key={datum.key} className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <Muted type="body-xs" numberOfLines={1} className="flex-1">
              {datum.name}
            </Muted>
            <Muted type="body-xs" className="font-semibold">
              {formatValue(datum.value)}
            </Muted>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-default-soft">
            <View
              className="h-1.5 rounded-full"
              style={{
                width: `${Math.round((datum.value / max) * 100)}%`,
                backgroundColor: accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
