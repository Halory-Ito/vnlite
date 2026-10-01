/**
 * 用户评分分布（10 分 → 1 分的直方图）。
 *
 * 手绘而不是上 chart-kit：这里要的就是「一根柱子一个小格」，
 * 标签是 1–10 的单字符，chart-kit 的轴标签留白反而浪费空间
 * （与收藏统计页厂商分布同类处理，见该页顶部说明）。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";

/** 柱区固定高度（pt）；每根柱按最大人数归一 */
const BAR_HEIGHT = 96;

export function VoteHistogram({
  data,
}: {
  data: { score: number; count: number }[];
}): JSX.Element | null {
  // 图标/颜色只能吃具体色值，柱子走主题 accent
  const accent = useThemeColor("accent");
  if (data.length === 0) return null;
  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <View className="flex-row items-end gap-1 px-4">
      {data.map((item) => {
        // 有人打过的档位至少给 6% 高度，否则「1 人」和「0 人」看起来一样
        const ratio = item.count > 0 ? Math.max((item.count / max) * 100, 6) : 0;
        return (
          <View key={item.score} className="flex-1 items-center gap-1">
            <Muted type="body-xs" className="text-[10px] opacity-70">
              {item.count > 0 ? item.count : ""}
            </Muted>
            <View
              className="w-full justify-end overflow-hidden rounded-sm bg-default-soft"
              style={{ height: BAR_HEIGHT }}
            >
              <View
                className="w-full rounded-sm"
                style={{ height: `${ratio}%`, backgroundColor: accent }}
              />
            </View>
            <Muted type="body-xs" className="text-[10px] opacity-70">
              {item.score}
            </Muted>
          </View>
        );
      })}
    </View>
  );
}
