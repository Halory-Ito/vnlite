/**
 * 记录统计 · 游玩数据分区。
 *
 * 数据是本地 `play_session`（游戏计时器每「结束」一次写一条）：
 *   - 游玩总览：总时长 / 游玩次数 / 游玩作品数
 *   - 游玩时长排名：按作品累计时长的横向条（Top 8）
 *   - 类型时长分布：ADV / NVL / RPG… 各类型的累计时长（横条，避免饼图里塞 ms）
 *   - 每月游玩时长：近 12 个月的竖条
 *   - 每周游玩统计：近 8 周的竖条
 *
 * 作品名与类型标签按 vnId 批量从 `/vn` 取（见 `hooks#usePlayedVnInfo`）。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { StatBlock } from "@/components/ui";
import { formatPlayDurationShort } from "@/features/play-records/format";
import { useAllPlaySessions } from "@/features/play-records/hooks";
import { summarizeSessions } from "@/features/play-records/play-stats";
import { useTranslation } from "@/hooks/use-translation";

import { HorizontalBars, Section, VerticalBars } from "./components/charts";
import { usePlayedVnInfo } from "./hooks";
import {
  monthlyPlayBuckets,
  playtimeByGameType,
  playtimeByVn,
  recentWeekBuckets,
  weekStartMs,
} from "./play-stats-logic";

/** 排名显示条数 */
const RANKING_LIMIT = 8;
/** 月 / 周图表窗口 */
const MONTH_WINDOW = 12;
const WEEK_WINDOW = 8;

/** 取当前时间（模块级，供 `useState` 惰性初始化，避免渲染期直接调 `new Date()`） */
function nowDate(): Date {
  return new Date();
}

export function PlayStatsSection(): JSX.Element {
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const { t } = useTranslation();
  const query = useAllPlaySessions();
  const sessions = useMemo(() => query.data ?? [], [query.data]);

  const vnIds = useMemo(() => [...new Set(sessions.map((s) => s.vnId))], [sessions]);
  const infoQuery = usePlayedVnInfo(vnIds);
  // 「现在」只取一次（当周 / 当月高亮用）。用模块级函数做惰性初始化，
  // 避免在渲染里直接调 `new Date()`（React Compiler purity 规则会报）
  const [now] = useState(nowDate);

  if (query.isLoading) {
    return (
      <Section title={t("stats.playTitle")}>
        <Muted type="body-xs" className="py-4">
          {t("stats.playLoading")}
        </Muted>
      </Section>
    );
  }

  if (query.isError) {
    return (
      <Section title={t("stats.playTitle")}>
        <Muted type="body-xs" className="py-4">
          {t("stats.playFailed")}
        </Muted>
      </Section>
    );
  }

  if (sessions.length === 0) {
    return (
      <Section title={t("stats.playTitle")}>
        <Muted type="body-xs" className="py-4">
          {t("stats.playEmpty")}
        </Muted>
      </Section>
    );
  }

  const summary = summarizeSessions(sessions);
  const info = infoQuery.data ?? [];
  const titleOf = new Map(info.map((vn) => [vn.id, vn.title]));
  const typesByVn = new Map(info.map((vn) => [vn.id, vn.typeIds]));

  const ranking = playtimeByVn(sessions)
    .slice(0, RANKING_LIMIT)
    .map((bucket) => ({
      key: bucket.vnId,
      name: titleOf.get(bucket.vnId) ?? bucket.vnId,
      value: bucket.ms,
    }));

  const types = playtimeByGameType(sessions, typesByVn);

  const monthly = monthlyPlayBuckets(sessions, MONTH_WINDOW, now).map((bucket) => ({
    key: `${bucket.year}-${bucket.month}`,
    label: t("stats.monthLabel", { month: bucket.month + 1 }),
    value: bucket.ms,
    highlight: bucket.year === now.getFullYear() && bucket.month === now.getMonth(),
  }));

  const weekly = recentWeekBuckets(sessions, WEEK_WINDOW, now).map((bucket) => {
    const date = new Date(bucket.startAt);
    return {
      key: String(bucket.startAt),
      label: `${date.getMonth() + 1}-${date.getDate()}`,
      value: bucket.ms,
      highlight: bucket.startAt === weekStartMs(now),
    };
  });

  return (
    <View>
      <View className="flex-row gap-2 px-4 py-4">
        <StatBlock
          value={formatPlayDurationShort(summary.totalMs)}
          label={t("stats.totalTime")}
          tone="accent"
        />
        <StatBlock value={String(summary.count)} label={t("stats.playCount")} />
        <StatBlock value={String(vnIds.length)} label={t("stats.playedVns")} />
      </View>

      <Section title={t("stats.playtimeRanking")}>
        <HorizontalBars data={ranking} formatValue={formatPlayDurationShort} />
      </Section>

      <Section title={t("stats.typePlaytime")}>
        {types.length > 0 ? (
          <HorizontalBars
            data={types.map((type) => ({ key: type.id, name: type.name, value: type.ms }))}
            formatValue={formatPlayDurationShort}
          />
        ) : (
          <Muted type="body-xs" className="py-4">
            {t("stats.playTypesEmpty")}
          </Muted>
        )}
      </Section>

      <Section title={t("stats.monthlyPlaytime")}>
        <VerticalBars
          data={monthly}
          formatValue={formatPlayDurationShort}
          accent={accent}
          muted={muted}
        />
      </Section>

      <Section title={t("stats.weeklyPlaytime")}>
        <VerticalBars
          data={weekly}
          formatValue={formatPlayDurationShort}
          accent={accent}
          muted={muted}
        />
      </Section>
    </View>
  );
}
