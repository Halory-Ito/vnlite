/**
 * 排序面板。
 *
 * 浏览页顶部的「排序」按钮打开它：**字段 + 方向**，点一下立即生效并写进偏好
 * （`preferences.browseSort`，跨启动记住）。
 *
 * 为什么从「三个 Tabs（发行日期 / 评分 / 人气）」换成面板：
 *   1. 字段变多了，横排的分段控件放不下（也没法再加方向）
 *   2. 方向（升 / 降序）需要一个位置，而它和字段是正交的两件事
 *   3. 和「筛选 / 显示」两个入口统一成同一种交互（全屏面板，见 `panel.tsx`）
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { useTranslation } from "@/hooks/use-translation";
import type { BrowseSortPreference } from "@/lib/storage/preferences";

import { FilterChip, FilterGroup } from "./filter-group";
import { FullScreenPanel } from "./panel";
import { BROWSE_SORT_OPTIONS, DEFAULT_BROWSE_SORT } from "@/features/sort/sort-options";

export interface SortPanelProps {
  value: BrowseSortPreference;
  onChange: (next: BrowseSortPreference) => void;
  onClose: () => void;
}

export function SortPanel({ value, onChange, onClose }: SortPanelProps): JSX.Element {
  const { t } = useTranslation();
  const isDefault =
    value.field === DEFAULT_BROWSE_SORT.value && value.reverse === DEFAULT_BROWSE_SORT.reverse;

  return (
    <FullScreenPanel
      title={t("browse.sort.title")}
      accessibilityLabel={t("browse.sort.title")}
      onClose={onClose}
      footer={
        <View className="flex-row items-center justify-between gap-3 border-t border-separator px-4 py-3">
          <Pressable
            onPress={() =>
              onChange({ field: DEFAULT_BROWSE_SORT.value, reverse: DEFAULT_BROWSE_SORT.reverse })
            }
            disabled={isDefault}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              isDefault ? "border-border opacity-40" : "border-accent"
            }`}
            accessibilityRole="button"
            accessibilityLabel={t("browse.sort.resetLabel")}
            accessibilityState={{ disabled: isDefault }}
          >
            <Typography type="body-xs" className="font-semibold text-accent">
              {t("browse.sort.reset")}
            </Typography>
          </Pressable>
        </View>
      }
    >
      <FilterGroup label={t("browse.sort.field")}>
        {BROWSE_SORT_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            option={{ value: option.value, label: t(option.labelKey) }}
            active={value.field === option.value}
            // 换字段时带上该字段的常用方向（如「发行日期」默认最新在前）
            onPress={() => onChange({ field: option.value, reverse: option.reverse })}
          />
        ))}
      </FilterGroup>

      <FilterGroup label={t("browse.sort.direction")}>
        <FilterChip
          option={{ value: "desc", label: t("browse.sort.desc") }}
          active={value.reverse}
          onPress={() => onChange({ ...value, reverse: true })}
        />
        <FilterChip
          option={{ value: "asc", label: t("browse.sort.asc") }}
          active={!value.reverse}
          onPress={() => onChange({ ...value, reverse: false })}
        />
      </FilterGroup>
    </FullScreenPanel>
  );
}
