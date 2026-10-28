/**
 * 各分组用到的**静态选项表**（语言 / 平台 / 评分档 / 票数档 / 年代）。
 *
 * 常用项放前面，减少滚动；文案在 render 期取（可切换语言，模块级不能存文案）
 * —— 语言 / 平台 用 `languageLabel()` / `platformLabel()`， votecount / released
 * 两个在 FilterPanel 里现场翻译。
 */

import { LENGTH, type DevStatus, type Language, type Platform } from "@/lib/api/enums";
import type { FilterChipOption } from "@/features/browse/components/filter-group";

/** 常用语言放前面，减少滚动（标签渲染期用 `languageLabel()` 取） */
export const POPULAR_LANGUAGES: Language[] = [
  "ja",
  "zh",
  "zh-Hans",
  "zh-Hant",
  "en",
  "ko",
  "fr",
  "de",
  "ru",
  "es",
  "it",
  "pt-br",
];

/** 常用平台放前面（标签渲染期用 `platformLabel()` 取） */
export const POPULAR_PLATFORMS: Platform[] = [
  "win",
  "mac",
  "lin",
  "and",
  "ios",
  "web",
  "ps5",
  "ps4",
  "swi",
  "xbo",
];

/** 时长选项直接用 VNDB 的英文描述（VNDB 原文即英文，两种语言都不翻译） */
export const LENGTH_OPTIONS: FilterChipOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: LENGTH[n] as string,
}));

export const RATING_OPTIONS: FilterChipOption[] = [
  { value: "90", label: "90+" },
  { value: "85", label: "85+" },
  { value: "80", label: "80+" },
  { value: "70", label: "70+" },
];

/** 票数下限（标签渲染期翻译，模块级不存文案） */
export const VOTECOUNTS = [10, 50, 100, 500] as const;

/** 发行年代：value 是 `releasedFrom` 的起始日期，标签渲染期翻译 */
export const DECADE_YEARS = [2020, 2015, 2010, 2005, 2000] as const;

/** 状态选项的原始值（devstatus 标签渲染期用 `devStatusLabel()` 取） */
export const DEV_STATUS_VALUES: DevStatus[] = [0, 1, 2];
