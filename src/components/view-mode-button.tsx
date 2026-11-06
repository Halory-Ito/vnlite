/**
 * 作品列表的视图切换按钮（**单个按钮**，不是 Tabs / 分段控件）。
 *
 * 图标与文案表示当前视图，点击切换到另一种视图。
 * 视觉沿用浏览页头部的图标按钮（`eye` / `sliders` 那一套）。
 *
 * 清单 Tab 与制作者详情的「作品」页签共用；选择存 `preferences.vnViewMode`，
 * 跨启动记住（两处共享同一个偏好）。
 */

import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { Icon, type IconName } from "./icon";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/i18n/translate";
import type { VnViewMode } from "@/lib/storage/preferences";

/** 当前视图的图标、文案与点击后切换的目标。 */
const MODES: Record<VnViewMode, { next: VnViewMode; icon: IconName; labelKey: TranslationKey }> = {
  grid: { next: "list", icon: "layoutCells", labelKey: "viewMode.grid" },
  list: { next: "grid", icon: "bars", labelKey: "viewMode.list" },
};

export interface ViewModeButtonProps {
  value: VnViewMode;
  onChange: (mode: VnViewMode) => void;
}

export function ViewModeButton({ value, onChange }: ViewModeButtonProps): JSX.Element {
  const accent = useThemeColor("accent");
  const { t } = useTranslation();
  const current = MODES[value];
  const label = t(current.labelKey);
  const targetLabel = t(MODES[current.next].labelKey);

  return (
    <Button
      size="sm"
      variant="ghost"
      onPress={() => onChange(current.next)}
      className="self-start gap-1 rounded-full px-2"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t("viewMode.switchTo", { target: targetLabel })}
    >
      {/* 图标只能吃具体色值（不吃 className），所以走主题 accent */}
      <Icon name={current.icon} size={18} color={accent} />
      <Button.Label className="text-sm text-accent">{label}</Button.Label>
    </Button>
  );
}
