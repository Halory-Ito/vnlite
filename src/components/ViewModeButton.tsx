/**
 * 作品列表的视图切换按钮（**单个按钮**，不是 Tabs / 分段控件）。
 *
 * 当前是网格就显示「列表」按钮，当前是列表就显示「网格」按钮 ——
 * 图标与文案表示**切过去会变成什么**，点一下直接切。
 * 视觉沿用浏览页头部的图标按钮（`eye` / `sliders` 那一套）。
 *
 * 清单 Tab 与制作者详情的「作品」页签共用；选择存 `preferences.vnViewMode`，
 * 跨启动记住（两处共享同一个偏好）。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { Muted } from "@/components/Typo";
import type { VnViewMode } from "@/lib/storage/preferences";

/** 当前视图 → 切过去的目标视图（图标 / 文案都描述目标） */
const SWITCH_TO: Record<VnViewMode, { next: VnViewMode; icon: IconName; label: string }> = {
  grid: { next: "list", icon: "bars", label: "列表" },
  list: { next: "grid", icon: "layoutCells", label: "网格" },
};

export interface ViewModeButtonProps {
  value: VnViewMode;
  onChange: (mode: VnViewMode) => void;
}

export function ViewModeButton({ value, onChange }: ViewModeButtonProps): JSX.Element {
  const accent = useThemeColor("accent");
  const target = SWITCH_TO[value];

  return (
    <Pressable
      onPress={() => onChange(target.next)}
      className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`切换到${target.label}视图`}
    >
      {/* 图标只能吃具体色值（不吃 className），所以走主题 accent */}
      <Icon name={target.icon} size={18} color={accent} />
      <Muted type="body-sm" className="text-accent">
        {target.label}
      </Muted>
    </Pressable>
  );
}
