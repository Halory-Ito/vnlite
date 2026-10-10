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

import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/i18n/translate";
import { CARD_FIELD, setPreference, type CardField } from "@/lib/storage/preferences";

import { FilterChip, FilterGroup, type FilterChipOption } from "./filter-group";
import { FullScreenPanel } from "./panel";

/** 卡片字段 → 翻译键（模块级不存文案，渲染时 `t(key)`） */
const CARD_FIELD_LABEL_KEY: Record<CardField, TranslationKey> = {
  rating: "browse.display.field.rating",
  released: "browse.display.field.released",
  olang: "browse.display.field.olang",
  length: "browse.display.field.length",
  platforms: "browse.display.field.platforms",
  devstatus: "browse.display.field.devstatus",
};

export interface DisplayPanelProps {
  onClose: () => void;
}

export function DisplayPanel({ onClose }: DisplayPanelProps): JSX.Element {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const selected = preferences.cardFields;

  const options: FilterChipOption[] = CARD_FIELD.map((field) => ({
    value: field,
    label: t(CARD_FIELD_LABEL_KEY[field]),
  }));

  /** 保持 CARD_FIELD 的固定顺序，免得 chip 顺序跟着点选跳 */
  const toggle = (field: CardField): void => {
    const next = selected.includes(field)
      ? selected.filter((f) => f !== field)
      : CARD_FIELD.filter((f) => f === field || selected.includes(f));
    void setPreference("cardFields", next);
  };

  return (
    <FullScreenPanel
      title={t("browse.display.title")}
      accessibilityLabel={t("browse.display.title")}
      onClose={onClose}
      footer={
        <View className="flex-row items-center justify-between gap-3 border-t border-separator px-4 py-3">
          <Pressable
            onPress={() => void setPreference("cardFields", [...CARD_FIELD])}
            disabled={selected.length === CARD_FIELD.length}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              selected.length === CARD_FIELD.length ? "border-border opacity-40" : "border-accent"
            }`}
            accessibilityRole="button"
            accessibilityLabel={t("browse.display.showAll")}
            accessibilityState={{ disabled: selected.length === CARD_FIELD.length }}
          >
            <Typography type="body-xs" className="font-semibold text-accent">
              {t("browse.display.showAll")}
            </Typography>
          </Pressable>
        </View>
      }
    >
      <FilterGroup label={t("browse.display.groupLabel")} activeCount={selected.length}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            active={selected.includes(option.value as CardField)}
            onPress={() => toggle(option.value as CardField)}
          />
        ))}
      </FilterGroup>
    </FullScreenPanel>
  );
}
