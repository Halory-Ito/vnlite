/**
 * 分隔线。
 *
 * HeroUI Native 没有 `Divider` 组件（只有 `Separator`），但 `Separator` 两侧
 * 固定留白，列表里不好控制，所以这里自己画。
 */

import { Separator as HeroSeparator } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

/** 带左侧缩进的列表分隔线（避开封面宽度） */
export function Separator({ inset = 78 }: { inset?: number }): JSX.Element {
  if (inset <= 0) return <HeroSeparator />;
  return (
    <View className="flex-row">
      <View style={{ width: inset }} />
      <HeroSeparator className="flex-1" />
    </View>
  );
}

/** 通栏分隔线，详情页各区块之间用 */
export function Divider({ className = "my-1" }: { className?: string }): JSX.Element {
  return <View className={`h-px bg-separator ${className}`} />;
}
