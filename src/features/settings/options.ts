/**
 * 设置页共用的选项表。
 *
 * 「我的」页拿它显示当前值（一行摘要），二级页拿它渲染分段控件 ——
 * 放一份，避免两处各写一遍中文名。
 */

import type { ColorSchemePreference, NsfwMode } from "@/lib/storage/preferences";

export const NSFW_OPTIONS: { value: NsfwMode; label: string }[] = [
  { value: "hide", label: "隐藏" },
  { value: "blur", label: "模糊" },
  { value: "show", label: "显示" },
];

export const SCHEME_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "亮" },
  { value: "dark", label: "暗" },
];

/** 每页条数（Kana 硬上限 100）。宽化成 string，分段控件的值就是字符串 */
export const PAGE_SIZE_OPTIONS: readonly string[] = ["25", "50", "100"];

/** 当前值的短标签，找不到时退回原值 */
export function optionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
