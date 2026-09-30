/**
 * 收藏统计（`/stats`）。
 *
 * 三张饼图 + 一排概览数字，数据全部来自**我自己的清单**（VNDB 直读，翻页拉全量）：
 *   1. 发售年代分布（十年一档，如 1990-1999）
 *   2. 清单标签分布（Playing / Finished / 自建标签…）
 *   3. 游戏类型分布（ADV / NVL / RPG…，VNDB 的 Technical 顶层标签）
 *   4. 厂商 Top 8 —— 横向条（手绘：chart-kit 经典 API 没有横向柱，
 *      而厂商名太长，塞进竖柱的 X 轴标签根本读不了）
 *
 * 类型分布要带 `vn.tags.id`（重得多），走独立查询 —— 它慢慢加载，
 * 其他图先出来（见 `hooks.ts`）。
 *
 * 颜色一律取主题 token（`accent` / `muted`），换主题跟着变；
 * 饼图除第一块用 accent 外，其余用固定色板（语义色不随主题走）。
 */

import { Button, Card, Spinner, useThemeColor } from "heroui-native";
import { useRouter } from "expo-router";
import type { ComponentProps, JSX, ReactNode } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { PieChart } from "react-native-chart-kit";

import { BackBar } from "@/components/BackBar";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { H5, Muted } from "@/components/Typo";
import { StatBlock } from "@/components/ui";
import { useUlistLabels } from "@/features/ulist/hooks";
import { useSession } from "@/hooks/useSession";
import type { UListItem } from "@/lib/api/types";
import { withAlpha } from "@/theme/color";
import { formatRating } from "@/utils/format";

import { useCollectionStats, useGameTypeBuckets } from "./hooks";
import { byListLabel, byReleaseDecade, summarizeCollection, topDevelopers } from "./statsLogic";

/** 饼图色板：第一块用主题 accent，其余固定（状态色不该随主题变） */
const SLICE_PALETTE = ["#2d9cdb", "#27ae60", "#f2994a", "#9b51e0", "#eb5757", "#56ccf2"];

/** chart-kit 的 chartConfig（它没导出类型，从组件 props 里取） */
type ChartConfig = ComponentProps<typeof PieChart>["chartConfig"];

export default function StatsScreen(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const isLoggedIn = session.status === "authenticated";
  const stats = useCollectionStats(isLoggedIn);

  if (!isLoggedIn) {
    return (
      <View className="flex-1">
        <BackBar title="收藏统计" />
        <EmptyState
          title="需要登录"
          description="统计要读你自己的清单。先在「我的 → 账号」粘贴 VNDB Token。"
          action={
            <Button size="sm" className="mt-2" onPress={() => router.push("/(tabs)/me")}>
              <Button.Label>去登录</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <BackBar title="收藏统计" />

      {stats.isLoading ? (
        <LoadingState label="正在统计你的收藏…" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <StatsContent items={stats.data ?? []} />
      )}
    </ScrollView>
  );
}

function StatsContent({ items }: { items: UListItem[] }): JSX.Element {
  const { width } = useWindowDimensions();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const labels = useUlistLabels();
  const types = useGameTypeBuckets(true);

  const summary = summarizeCollection(items);
  const decades = byReleaseDecade(items);
  const byLabel = byListLabel(items, labels.data ?? []);
  const developers = topDevelopers(items);

  if (items.length === 0) {
    return (
      <EmptyState
        title="清单还是空的"
        description="去 VNDB 收藏几部作品，这里就会有年代 / 标签 / 类型 / 厂商的分布图"
      />
    );
  }

  /** 卡片左右各 16pt 内边距，图表的可用宽度 */
  const chartWidth = width - 32;

  const chartConfig = {
    backgroundGradientFrom: "transparent",
    backgroundGradientTo: "transparent",
    decimalPlaces: 0,
    color: (opacity = 1) => withAlpha(accent, opacity),
    labelColor: (opacity = 1) => withAlpha(muted, opacity),
    propsForBackgroundLines: { stroke: withAlpha(muted, 0.25) },
  };

  return (
    <View>
      <View className="flex-row gap-2 px-4 py-4">
        <StatBlock value={String(summary.total)} label="收藏总数" tone="accent" />
        <StatBlock value={String(summary.finished)} label="已通关" />
        <StatBlock value={formatRating(summary.averageVote)} label="我的均分" />
      </View>

      <PieSection
        title="发售年代"
        buckets={decades.map((bucket) => ({ name: bucket.label, count: bucket.count }))}
        width={chartWidth}
        accent={accent}
        muted={muted}
        chartConfig={chartConfig}
      />

      {byLabel.length > 0 ? (
        <PieSection
          title="清单标签"
          buckets={byLabel}
          width={chartWidth}
          accent={accent}
          muted={muted}
          chartConfig={chartConfig}
        />
      ) : null}

      <TypeSection
        types={types}
        width={chartWidth}
        accent={accent}
        muted={muted}
        chartConfig={chartConfig}
      />

      {developers.length > 0 ? (
        <Section title={`厂商 Top ${developers.length}`}>
          <DeveloperBars developers={developers} />
        </Section>
      ) : null}
    </View>
  );
}

/** 饼图卡片：把 `{ name, count }` 聚合成 chart-kit 的饼图（第一块用主题 accent） */
function PieSection({
  title,
  buckets,
  width,
  accent,
  muted,
  chartConfig,
}: {
  title: string;
  buckets: readonly { name: string; count: number }[];
  width: number;
  accent: string;
  muted: string;
  chartConfig: ChartConfig;
}): JSX.Element {
  if (buckets.length === 0) {
    return (
      <Section title={title}>
        <Muted type="body-xs" className="py-4">
          没有可统计的数据
        </Muted>
      </Section>
    );
  }

  return (
    <Section title={title}>
      <PieChart
        data={buckets.map((bucket, index) => ({
          name: bucket.name,
          count: bucket.count,
          color: index === 0 ? accent : (SLICE_PALETTE[index - 1] ?? accent),
          legendFontColor: muted,
          legendFontSize: 12,
        }))}
        width={width}
        height={Math.max(160, 40 * buckets.length)}
        chartConfig={chartConfig}
        accessor="count"
        backgroundColor="transparent"
        paddingLeft="0"
        absolute
        hasLegend
      />
    </Section>
  );
}

/** 游戏类型卡片：自己带加载态（这一趟带 tags，比别的图慢） */
function TypeSection({
  types,
  width,
  accent,
  muted,
  chartConfig,
}: {
  types: ReturnType<typeof useGameTypeBuckets>;
  width: number;
  accent: string;
  muted: string;
  chartConfig: ChartConfig;
}): JSX.Element {
  if (types.isLoading) {
    return (
      <Section title="游戏类型">
        <View className="items-center gap-2 py-6">
          <Spinner size="sm" />
          <Muted type="body-xs">正在统计类型标签…</Muted>
        </View>
      </Section>
    );
  }

  if (types.isError) {
    return (
      <Section title="游戏类型">
        <Muted type="body-xs" className="py-4">
          类型统计失败：{types.error instanceof Error ? types.error.message : "未知错误"}
        </Muted>
      </Section>
    );
  }

  const buckets = types.data ?? [];
  if (buckets.length === 0) {
    return (
      <Section title="游戏类型">
        <Muted type="body-xs" className="py-4">
          你的收藏里没有标出 ADV / NVL / RPG 这类类型标签
        </Muted>
      </Section>
    );
  }

  return (
    <PieSection
      title="游戏类型"
      buckets={buckets}
      width={width}
      accent={accent}
      muted={muted}
      chartConfig={chartConfig}
    />
  );
}

/** 图表卡片：统一的标题 + 白底容器 */
function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <Card className="mx-4 my-2">
      <Card.Body className="gap-3">
        <H5>{title}</H5>
        <View className="items-center">{children}</View>
      </Card.Body>
    </Card>
  );
}

/** 厂商分布：手绘横向条（名字在左、计数在右、条长按最大值为基准） */
function DeveloperBars({
  developers,
}: {
  developers: ReturnType<typeof topDevelopers>;
}): JSX.Element {
  const accent = useThemeColor("accent");
  const max = developers[0]?.count ?? 1;

  return (
    <View className="w-full gap-2.5">
      {developers.map((developer) => (
        <View key={developer.id} className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <Muted type="body-xs" numberOfLines={1} className="flex-1">
              {developer.name}
            </Muted>
            <Muted type="body-xs" className="font-semibold">
              {developer.count}
            </Muted>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-default-soft">
            <View
              className="h-1.5 rounded-full"
              style={{
                width: `${Math.round((developer.count / max) * 100)}%`,
                backgroundColor: accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
