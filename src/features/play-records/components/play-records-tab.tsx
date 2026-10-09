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
import { useState } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { SegmentedControl, type SegmentedOption } from "@/components/segmented-control";

import { usePlaySessions } from "../hooks";
import { PlayRecordsChart } from "./play-records-chart";
import { PlayRecordsList } from "./play-records-list";

type PlayRecordsView = "chart" | "list";

const VIEW_OPTIONS: SegmentedOption<PlayRecordsView>[] = [
  { value: "chart", label: "图表" },
  { value: "list", label: "列表" },
];

export function PlayRecordsTab({ vnId }: { vnId: string }): JSX.Element {
  const [view, setView] = useState<PlayRecordsView>("chart");
  const query = usePlaySessions(vnId);

  if (query.isLoading) return <LoadingState label="加载游玩记录…" className="py-12" />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const sessions = query.data ?? [];
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="暂无游玩记录"
        description="在作品详情页点「开始游戏」，结束后会记录在这里"
      />
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 py-2">
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      </View>
      {view === "chart" ? (
        <PlayRecordsChart sessions={sessions} />
      ) : (
        <PlayRecordsList sessions={sessions} />
      )}
    </View>
  );
}
