/**
 * 卡片显示面板。
 *
 * 「浏览」页列表卡片上显示哪些信息（评分 / 发售日期 / 原语言 / 时长 / 平台 /
 * 开发状态）。**它和筛选是两回事**：筛选取的是「哪些作品」，这里选的是
 * 「卡片上写什么」，所以不放在筛选面板里，而是自己一个入口（在筛选按钮左边）。
 *
 * 选择存 `preferences.cardFields`（本地偏好，跨启动记住）。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/Typo";
import { usePreferences } from "@/hooks/usePreferences";
import {
  CARD_FIELD,
  CARD_FIELD_LABEL,
  setPreference,
  type CardField,
} from "@/lib/storage/preferences";

import { FilterChip, FilterGroup, type FilterChipOption } from "./FilterGroup";
import { FullScreenPanel } from "./Panel";

const CARD_FIELD_OPTIONS: FilterChipOption[] = CARD_FIELD.map((field) => ({
  value: field,
  label: CARD_FIELD_LABEL[field],
}));

export interface DisplayPanelProps {
  onClose: () => void;
}

export function DisplayPanel({ onClose }: DisplayPanelProps): JSX.Element {
  const preferences = usePreferences();
  const selected = preferences.cardFields;

  /** 保持 CARD_FIELD 的固定顺序，免得 chip 顺序跟着点选跳 */
  const toggle = (field: CardField): void => {
    const next = selected.includes(field)
      ? selected.filter((f) => f !== field)
      : CARD_FIELD.filter((f) => f === field || selected.includes(f));
    void setPreference("cardFields", next);
  };

  return (
    <FullScreenPanel
      title="卡片显示"
      accessibilityLabel="卡片显示"
      onClose={onClose}
      footer={
        <View className="flex-row items-center justify-between gap-3 border-t border-separator px-4 py-3">
          <Muted type="body-xs">
            {selected.length === 0
              ? "只显示标题与封面"
              : `已开启 ${selected.length} / ${CARD_FIELD.length} 项`}
          </Muted>
          <Pressable
            onPress={() => void setPreference("cardFields", [...CARD_FIELD])}
            disabled={selected.length === CARD_FIELD.length}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              selected.length === CARD_FIELD.length ? "border-border opacity-40" : "border-accent"
            }`}
            accessibilityRole="button"
            accessibilityLabel="全部显示"
            accessibilityState={{ disabled: selected.length === CARD_FIELD.length }}
          >
            <Typography type="body-xs" className="font-semibold text-accent">
              全部显示
            </Typography>
          </Pressable>
        </View>
      }
    >
      <FilterGroup label="列表卡片上显示的信息" activeCount={selected.length}>
        {CARD_FIELD_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            active={selected.includes(option.value as CardField)}
            onPress={() => toggle(option.value as CardField)}
          />
        ))}
      </FilterGroup>

      <Muted type="body-xs">
        标题与封面始终显示。这里的选择只影响卡片外观，不参与筛选，也不会重新请求数据。
      </Muted>
    </FullScreenPanel>
  );
}
