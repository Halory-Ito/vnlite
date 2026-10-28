/**
 * 清单分析（`/stats/list`）。
 *
 * 与「记录统计」页互补：那一页是**游玩时长 + 收藏概览**，这一页专门回答
 * 「我的清单是什么样子」——状态分布、打分习惯、待玩规模、与社区的差异。
 *
 * 数据仍然是整份清单（`useCollectionStats`，翻页拉全量），需要登录。
 */

import type { JSX } from "react";
import { ScrollView, View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { StatBlock } from "@/components/ui";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";
import type { UListItem } from "@/lib/api/types";

import { HorizontalBars, Section } from "@/features/stats/components/charts";
import { useCollectionStats } from "@/features/stats/hooks";
import {
  backlogSummary,
  completionSummary,
  statusBuckets,
  voteBuckets,
  voteComparison,
} from "@/features/stats/lib/list-analysis";
import { byReleaseDecade } from "@/features/stats/lib/stats-logic";

export default function ListAnalysisScreen(): JSX.Element {
  const { t } = useTranslation();
  const session = useSession();
  const loggedIn = session.status === "authenticated";
  const query = useCollectionStats(loggedIn);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <BackBar title={t("stats.laTitle")} />

      {!loggedIn ? (
        <EmptyState
          title={t("stats.laLoginTitle")}
          description={t("stats.laLoginDescription")}
          className="py-16"
        />
      ) : query.isLoading ? (
        <LoadingState label={t("stats.collectionLoading")} className="py-12" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <AnalysisContent items={query.data ?? []} />
      )}
    </ScrollView>
  );
}

function AnalysisContent({ items }: { items: UListItem[] }): JSX.Element {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("stats.collectionEmpty")}
        description={t("stats.laEmptyDescription")}
        className="py-16"
      />
    );
  }

  const completion = completionSummary(items);
  const backlog = backlogSummary(items);
  const comparison = voteComparison(items);
  const votes = voteBuckets(items);
  const statuses = statusBuckets(items).filter((bucket) => bucket.count > 0);
  const decades = byReleaseDecade(items);

  return (
    <View>
      <View className="flex-row gap-2 px-4 py-3">
        <StatBlock value={String(completion.total)} label={t("stats.total")} />
        <StatBlock value={String(completion.finished)} label={t("stats.finished")} />
        <StatBlock
          value={`${Math.round(completion.rate * 100)}%`}
          label={t("stats.laRate")}
          tone="accent"
        />
      </View>

      <View className="gap-2 px-4 pb-3">
        <Muted type="body-xs">
          {t("stats.laBacklog", { count: backlog.count, hours: backlog.hours })}
        </Muted>
        <Muted type="body-xs" className="opacity-70">
          {t("stats.laBacklogHint", { known: backlog.known, total: backlog.count })}
        </Muted>
      </View>

      {comparison.count > 0 ? (
        <View className="flex-row gap-2 px-4 pb-3">
          <StatBlock value={fixed1(comparison.mine)} label={t("stats.laMyVote")} />
          <StatBlock value={fixed1(comparison.community)} label={t("stats.laCommunityVote")} />
          <StatBlock
            value={signed1(comparison.delta)}
            label={t("stats.laVoteDelta")}
            tone={comparison.delta != null && comparison.delta >= 0 ? "accent" : undefined}
          />
        </View>
      ) : null}

      <Section title={t("stats.laStatus")}>
        <HorizontalBars
          data={statuses.map((bucket) => ({
            key: String(bucket.id),
            name: bucket.name,
            value: bucket.count,
          }))}
          formatValue={String}
        />
      </Section>

      <Section title={t("stats.laVotes")}>
        <HorizontalBars
          data={votes.map((bucket) => ({
            key: String(bucket.score),
            name: t("stats.laScore", { score: bucket.score }),
            value: bucket.count,
          }))}
          formatValue={String}
        />
      </Section>

      {decades.length > 0 ? (
        <Section title={t("stats.decades")}>
          <HorizontalBars
            data={decades.map((bucket) => ({
              key: bucket.label,
              name: bucket.label,
              value: bucket.count,
            }))}
            formatValue={String}
          />
        </Section>
      ) : null}
    </View>
  );
}

/** 一位小数（`null` → `—`） */
function fixed1(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

/** 带符号的一位小数：`+0.6` / `-1.2` */
function signed1(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}
