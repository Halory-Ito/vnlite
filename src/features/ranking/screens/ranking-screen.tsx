/**
 * 排行榜（`/ranking`）。
 *
 * 三档：
 *   年度 —— 某一年发售的作品按评分排前 10
 *   题材 —— 在题材列表里挑一组（可多选 / 可自定义增删，见 `components/tag-ranking`）
 *           按评分排前 10
 *   大赏 —— 暂以「待开发」占位（数据管线已在仓库，见 `features/awards`；
 *         恢复上线时接回 `components/awards-section`）
 *
 * 评分用的是 VNDB 的贝叶斯评分，再叠一个「至少 30 票」的门槛，
 * 免得榜首全是一两票的冷门 100 分。
 */

import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { EmptyState } from "@/components/screen-state";
import { SegmentedControl } from "@/components/segmented-control";
import { useTranslation } from "@/hooks/use-translation";
import { todayIso } from "@/utils/format";

import { ChipRow } from "@/features/ranking/components/chip-row";
import { FilterChip } from "@/features/browse/components/filter-group";
import { RankingList } from "@/features/ranking/components/ranking-list";
import { TagRanking } from "@/features/ranking/components/tag-ranking";
import { useYearRanking } from "@/features/ranking/hooks";

type Mode = "year" | "tag" | "awards";

/** 年度榜从 2000 年开始（再早的作品太少，榜单没意义） */
const FIRST_YEAR = 2000;

export default function RankingScreen(): JSX.Element {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("year");

  const modes = [
    { value: "year" as const, label: t("ranking.modeYear") },
    { value: "tag" as const, label: t("ranking.modeTag") },
    { value: "awards" as const, label: t("ranking.modeComing") },
  ];

  return (
    <View className="flex-1">
      <BackBar title={t("ranking.title")} />
      <View className="px-4 pb-2">
        <SegmentedControl options={modes} value={mode} onChange={setMode} />
      </View>

      {mode === "year" ? <YearRanking /> : null}
      {mode === "tag" ? <TagRanking /> : null}
      {mode === "awards" ? <EmptyState title={t("ranking.awardsComingSoon")} /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 年度榜                                                                      */
/* -------------------------------------------------------------------------- */

function YearRanking(): JSX.Element {
  const { t } = useTranslation();
  // 用现成的日期工具取「今年」（组件里直接 new Date() 会被 react/purity 拦下）
  const thisYear = Number(todayIso().slice(0, 4));
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);
  const [year, setYear] = useState(thisYear);
  const query = useYearRanking(year);

  return (
    <View className="flex-1">
      <ChipRow label={t("ranking.pickYear")}>
        {years.map((item) => (
          <FilterChip
            key={item}
            option={{ value: String(item), label: String(item) }}
            active={item === year}
            onPress={() => setYear(item)}
          />
        ))}
      </ChipRow>

      <RankingList
        items={query.data?.results ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 横向 chip 行：见 components/chip-row（年度 / Getchu 部门共用）                */
/* -------------------------------------------------------------------------- */
