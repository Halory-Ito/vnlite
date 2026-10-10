/**
 * 记录统计（`/stats`）。
 *
 * 上下两块**数据源完全不同**：
 *   1. 上半「游玩统计」—— 本地 `play_session`（游戏计时器写入），**不需要登录**
 *   2. 下半「收藏统计」—— 我自己的 VNDB 清单（直读、翻页拉全量），**需要登录**
 *
 * 收藏部分：概览数字 + 发售年代 / 清单标签 / 游戏类型三张饼图 + 厂商 Top 横条。
 * 类型分布要带 `vn.tags.id`（重得多），走独立查询 —— 它慢慢加载，其他图先出来。
 *
 * 图表外壳与条形图抽在 `components/charts`（与游玩统计共用）。
 */

import { Button, Spinner, useThemeColor } from "heroui-native";
import { useRouter } from "expo-router";
import type { JSX } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { StatBlock } from "@/components/ui";
import { useUlistLabels } from "@/features/ulist/hooks";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";
import type { UListItem } from "@/lib/api/types";
import { withAlpha } from "@/theme/color";
import { formatRating } from "@/utils/format";

import { HorizontalBars, PieSection, Section, type ChartConfig } from "./components/charts";
import { useCollectionStats, useGameTypeBuckets } from "./hooks";
import { PlayStatsSection } from "./play-stats-section";
import { byListLabel, byReleaseDecade, summarizeCollection, topDevelopers } from "./stats-logic";

export default function StatsScreen(): JSX.Element {
  const { t } = useTranslation();
  const session = useSession();
  const isLoggedIn = session.status === "authenticated";

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <BackBar title={t("stats.title")} />

      {/* 游玩统计：本地数据，游客也能看 */}
      <PlayStatsSection />

      {isLoggedIn ? <CollectionStatsSection /> : <LoginHint />}
    </ScrollView>
  );
}

/** 未登录时收藏部分的占位（游玩统计仍照常显示） */
function LoginHint(): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Section title={t("stats.collectionTitle")}>
      <Muted type="body-xs" className="py-4">
        {t("stats.loginHint")}
      </Muted>
      <Button size="sm" className="mt-2" onPress={() => router.push("/(tabs)/me")}>
        <Button.Label>{t("stats.goLogin")}</Button.Label>
      </Button>
    </Section>
  );
}

function CollectionStatsSection(): JSX.Element {
  const { t } = useTranslation();
  const stats = useCollectionStats(true);

  if (stats.isLoading)
    return <LoadingState label={t("stats.collectionLoading")} className="py-8" />;
  if (stats.isError) {
    return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  }
  return <CollectionContent items={stats.data ?? []} />;
}

function CollectionContent({ items }: { items: UListItem[] }): JSX.Element {
  const { t } = useTranslation();
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
      <Section title={t("stats.collectionTitle")}>
        <Muted type="body-xs" className="py-4">
          {t("stats.collectionEmpty")}
        </Muted>
      </Section>
    );
  }

  /** 卡片左右各 16pt 内边距，图表的可用宽度 */
  const chartWidth = width - 32;
  const chartConfig: ChartConfig = {
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
        <StatBlock value={String(summary.total)} label={t("stats.total")} tone="accent" />
        <StatBlock value={String(summary.finished)} label={t("stats.finished")} />
        <StatBlock value={formatRating(summary.averageVote)} label={t("stats.averageVote")} />
      </View>

      <PieSection
        title={t("stats.decades")}
        buckets={decades.map((bucket) => ({ name: bucket.label, value: bucket.count }))}
        width={chartWidth}
        accent={accent}
        muted={muted}
        chartConfig={chartConfig}
      />

      {byLabel.length > 0 ? (
        <PieSection
          title={t("stats.labels")}
          buckets={byLabel.map((bucket) => ({ name: bucket.name, value: bucket.count }))}
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
        <Section title={t("stats.topDevelopers", { count: developers.length })}>
          <HorizontalBars
            data={developers.map((developer) => ({
              key: developer.id,
              name: developer.name,
              value: developer.count,
            }))}
            formatValue={String}
          />
        </Section>
      ) : null}
    </View>
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
  const { t } = useTranslation();
  if (types.isLoading) {
    return (
      <Section title={t("stats.gameTypes")}>
        <View className="items-center gap-2 py-6">
          <Spinner size="sm" />
          <Muted type="body-xs">{t("stats.typesLoading")}</Muted>
        </View>
      </Section>
    );
  }

  if (types.isError) {
    return (
      <Section title={t("stats.gameTypes")}>
        <Muted type="body-xs" className="py-4">
          {t("stats.typesFailed", {
            message: types.error instanceof Error ? types.error.message : t("common.unknownError"),
          })}
        </Muted>
      </Section>
    );
  }

  return (
    <PieSection
      title={t("stats.gameTypes")}
      buckets={(types.data ?? []).map((bucket) => ({ name: bucket.name, value: bucket.count }))}
      width={width}
      accent={accent}
      muted={muted}
      chartConfig={chartConfig}
      emptyText={t("stats.typesEmpty")}
    />
  );
}
