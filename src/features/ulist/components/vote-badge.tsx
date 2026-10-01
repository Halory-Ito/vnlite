/**
 * 「我的打分」徽标。
 *
 * ⚠️ 不要和 `components/ui.tsx` 的 `RatingBadge` 混淆：
 * 那个是 VNDB 的贝叶斯评分（0–100 的小数，含票数），
 * 这个是用户自己的打分（10–100 整数）。未打分显示「—」中性底。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

export function VoteBadge({ vote }: { vote: number | null | undefined }): JSX.Element {
  const scored = vote != null;
  return (
    <View
      className={`min-w-9 items-center rounded-md px-1.5 py-0.5 ${
        scored ? "bg-accent-soft" : "bg-default-soft"
      }`}
    >
      <Typography
        type="body-xs"
        className={scored ? "font-semibold text-accent-soft-foreground" : "text-muted"}
      >
        {scored ? vote : "—"}
      </Typography>
    </View>
  );
}
