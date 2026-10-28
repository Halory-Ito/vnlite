/**
 * 大赏分两类（Master 要求）：
 * - **萌系游戏大赏**（萌えゲーアワード）—— 层级区分：大賞 / 準大賞 / 金 / 銀 / 銅
 * - **美少女游戏大赏**（Getchu 年度投票）—— 选年份 + 部门看名次列表
 *
 * 用和排行榜三档一样的 `SegmentedControl` 切换，子列表各自管理选择状态。
 */

import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { SegmentedControl } from "@/components/segmented-control";
import { useTranslation } from "@/hooks/use-translation";

import { GetchuAwards } from "./awards-getchu";
import { MoeAwards } from "./awards-moe";

export function AwardsSection(): JSX.Element {
  const { t } = useTranslation();
  const [source, setSource] = useState<"moe" | "getchu">("moe");

  return (
    <View className="flex-1">
      <View className="px-4 pb-2">
        <SegmentedControl
          options={[
            { value: "moe" as const, label: t("ranking.awardsMoe") },
            { value: "getchu" as const, label: t("ranking.awardsGetchu") },
          ]}
          value={source}
          onChange={setSource}
        />
      </View>
      {source === "moe" ? <MoeAwards /> : <GetchuAwards />}
    </View>
  );
}
