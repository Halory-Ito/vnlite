/**
 * 胶囊按钮。清单页的标签筛选、编辑页的标签与持有状态共用。
 *
 * 视觉沿用浏览页 `FilterChip` 的约定：选中 = 淡色底 + accent 文字，
 * 未选中 = 描边 + 次要文字（实心 `bg-accent` 在背景图上过于抢眼）。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";

export interface PillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function Pill({ label, active, onPress }: PillProps): JSX.Element {
  // 清单标签名来自 VNDB，可能带首尾空白 —— 一律 trim（芯片折行 + 裁剪会只显示前半截）
  const text = label.trim();
  return (
    <Pressable
      onPress={onPress}
      className={`shrink-0 rounded-full border px-3 py-1.5 active:opacity-70 ${
        active ? "border-accent bg-accent-soft" : "border-border bg-default-soft"
      }`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={text}
    >
      <Typography
        type="body-xs"
        numberOfLines={1}
        className={active ? "font-semibold text-accent" : "text-muted"}
      >
        {text}
      </Typography>
    </Pressable>
  );
}
