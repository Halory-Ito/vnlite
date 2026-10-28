/**
 * 萌えゲーアワード：年份分段列表，行内是主线层级的获奖作品
 * （大賞 / 準大賞 / 金 / 銀 / 銅；大賞行高亮）。数据见 `features/awards/lib/awards`。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { ScrollView, View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import { AwardRow } from "@/features/awards/components/award-row";
import { moeEntriesFor, moeYears } from "@/features/awards/lib/awards";

/** 层级 → i18n key（`as const` 保住字面量类型，t() 的 key 必须可穷举） */
const PRIZE_KEYS = {
  grand: "ranking.prizeGrand",
  semi: "ranking.prizeSemi",
  gold: "ranking.prizeGold",
  silver: "ranking.prizeSilver",
  bronze: "ranking.prizeBronze",
} as const;

export function MoeAwards(): JSX.Element {
  const { t } = useTranslation();
  const years = moeYears();

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <Muted type="body-xs" className="px-4 pb-1">
        {t("ranking.awardsMoeNote")}
      </Muted>
      {years.map((year) => (
        <View key={year} className="gap-0.5">
          <Typography type="body-sm" className="px-4 pt-3 pb-1 font-semibold">
            {year}
          </Typography>
          {moeEntriesFor(year).map((entry) => (
            <AwardRow
              key={`${entry.prize}:${entry.title}`}
              badge={t(PRIZE_KEYS[entry.prize])}
              highlight={entry.prize === "grand"}
              title={entry.title}
              brand={entry.brand}
              vnId={entry.vnId}
              ariaLabel={`${t(PRIZE_KEYS[entry.prize])} ${year} ${entry.title}`}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
