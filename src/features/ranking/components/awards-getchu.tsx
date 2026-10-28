/**
 * 美少女ゲーム大賞（Getchu 年度投票）：年份 + 部门两级选择，下面是
 * 名次列表（前三名徽章高亮，同 `RankingList` 的配色习惯）。
 * 数据 2010–2023（Getchu 2024 停服），见 `features/awards/lib/awards`。
 */

import type { JSX } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Muted } from "@/components/typo";
import { FilterChip } from "@/features/browse/components/filter-group";
import { useTranslation } from "@/hooks/use-translation";
import { AwardRow } from "@/features/awards/components/award-row";
import {
  GETCHU_DEPT_ORDER,
  getchuEntriesFor,
  getchuHasDept,
  getchuYears,
  type GetchuDept,
} from "@/features/awards/lib/awards";

import { ChipRow } from "./chip-row";

/** 部门 → i18n key（`as const` 保住字面量类型） */
const DEPT_KEYS = {
  total: "ranking.deptTotal",
  scenario: "ranking.deptScenario",
  system: "ranking.deptSystem",
  graphic: "ranking.deptGraphic",
  music: "ranking.deptMusic",
  movie: "ranking.deptMovie",
  chara: "ranking.deptChara",
  eros: "ranking.deptEros",
} as const;

const DEPTS = Object.keys(GETCHU_DEPT_ORDER) as GetchuDept[];

export function GetchuAwards(): JSX.Element {
  const { t } = useTranslation();
  const years = getchuYears();
  const [year, setYear] = useState(years[0] ?? 2023);
  const [dept, setDept] = useState<GetchuDept>("total");

  /** 换年时若已选部门在新年份没有数据（抓取缺），回到総合 */
  const selectYear = (y: number): void => {
    setYear(y);
    if (!getchuHasDept(y, dept)) setDept("total");
  };

  const entries = getchuEntriesFor(year, dept);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <Muted type="body-xs" className="px-4 pb-1">
        {t("ranking.awardsGetchuNote")}
      </Muted>

      <ChipRow label={t("ranking.pickYear")}>
        {years.map((y) => (
          <FilterChip
            key={y}
            option={{ value: String(y), label: String(y) }}
            active={y === year}
            onPress={() => selectYear(y)}
          />
        ))}
      </ChipRow>

      <ChipRow label={t("ranking.pickDept")}>
        {DEPTS.filter((d) => getchuHasDept(year, d)).map((d) => (
          <FilterChip
            key={d}
            option={{ value: d, label: t(DEPT_KEYS[d]) }}
            active={d === dept}
            onPress={() => setDept(d)}
          />
        ))}
      </ChipRow>

      {entries.length === 0 ? null : (
        <View className="mt-1">
          {entries.map((entry) => (
            <AwardRow
              key={`${entry.dept}:${entry.rank}`}
              badge={String(entry.rank)}
              highlight={entry.rank <= 3}
              title={entry.title}
              brand={entry.brand}
              vnId={entry.vnId}
              ariaLabel={t("ranking.rowLabel", { rank: entry.rank, title: entry.title })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
