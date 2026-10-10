/**
 * VN 详情 · 游玩记录页签。
 *
 * 两个视图互斥切换：
 *   - 图表：统计数字 + 近 14 天每日时长的柱状图
 *   - 列表：每一次游玩的日期、起止时间与时长
 *
 * 数据是本地 SQLite（计时器结束时写入），见 `../hooks` 与 `play-stats`。
 */

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { SegmentedControl, type SegmentedOption } from "@/components/segmented-control";
import { useTranslation } from "@/hooks/use-translation";

import { usePlaySessions } from "../hooks";
import { PlayRecordsChart } from "./play-records-chart";
import { PlayRecordsList } from "./play-records-list";

type PlayRecordsView = "chart" | "list";

export function PlayRecordsTab({ vnId }: { vnId: string }): JSX.Element {
  const [view, setView] = useState<PlayRecordsView>("chart");
  const { t } = useTranslation();
  const query = usePlaySessions(vnId);

  // 视图切换的文案要随语言变化 —— 选项在渲染期生成，不在模块级常量里存文案
  const options = useMemo<SegmentedOption<PlayRecordsView>[]>(
    () => [
      { value: "chart", label: t("records.view.chart") },
      { value: "list", label: t("records.view.list") },
    ],
    [t]
  );

  if (query.isLoading) return <LoadingState label={t("records.loading")} className="py-12" />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const sessions = query.data ?? [];
  if (sessions.length === 0) {
    return (
      <EmptyState title={t("records.emptyTitle")} description={t("records.emptyDescription")} />
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 py-2">
        <SegmentedControl options={options} value={view} onChange={setView} />
      </View>
      {view === "chart" ? (
        <PlayRecordsChart sessions={sessions} />
      ) : (
        <PlayRecordsList sessions={sessions} />
      )}
    </View>
  );
}
