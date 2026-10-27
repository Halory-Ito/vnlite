/**
 * 设置页共用的选项表。
 *
 * 「我的」页拿它显示当前值（一行摘要），二级页拿它渲染分段控件 ——
 * 放一份，避免两处各写一遍。
 *
 * ⚠️ 这里存的是**翻译键**不是文案：语言可切换，任何模块级常量都不能存死文案。
 * 渲染时用 `translateOptions` / `optionLabel` 配上 `useTranslation()` 的 `t`。
 */

import type { SegmentedOption } from "@/components/segmented-control";
import type { Language, TranslationKey } from "@/lib/i18n/translate";
import type { ColorSchemePreference, NsfwMode } from "@/lib/storage/preferences";

export interface SettingsOption<T extends string> {
  value: T;
  labelKey: TranslationKey;
}

export const NSFW_OPTIONS: SettingsOption<NsfwMode>[] = [
  { value: "hide", labelKey: "settings.nsfwHide" },
  { value: "blur", labelKey: "settings.nsfwBlur" },
  { value: "show", labelKey: "settings.nsfwShow" },
];

export const SCHEME_OPTIONS: SettingsOption<ColorSchemePreference>[] = [
  { value: "system", labelKey: "settings.schemeSystem" },
  { value: "light", labelKey: "settings.schemeLight" },
  { value: "dark", labelKey: "settings.schemeDark" },
];

export const LANGUAGE_OPTIONS: SettingsOption<Language>[] = [
  { value: "system", labelKey: "settings.languageSystem" },
  { value: "zh", labelKey: "settings.languageZh" },
  { value: "en", labelKey: "settings.languageEn" },
];

/** 每页条数（Kana 硬上限 100）。宽化成 string，分段控件的值就是字符串 */
export const PAGE_SIZE_OPTIONS: readonly string[] = ["25", "50", "100"];

/** 翻译键 → 分段控件的选项（渲染期调用） */
export function translateOptions<T extends string>(
  options: readonly SettingsOption<T>[],
  t: (key: TranslationKey) => string
): SegmentedOption<T>[] {
  return options.map((option) => ({ value: option.value, label: t(option.labelKey) }));
}

/** 当前值的短标签（渲染时翻译），找不到时退回原值 */
export function optionLabel<T extends string>(
  options: readonly SettingsOption<T>[],
  value: T,
  t: (key: TranslationKey) => string
): string {
  const option = options.find((item) => item.value === value);
  return option ? t(option.labelKey) : value;
}
