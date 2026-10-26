/**
 * 半透明卡片底。
 *
 * 全局背景图铺在最底层（`components/app-background`），卡片如果是不透明的
 * `surface`，整屏就只剩一条条色块、背景图白设了。所以列表 / 卡片统一
 * 用一层**带透明度的 surface**：底色还是主题 surface（文字对比度可控），
 * 只是让背景图透出来一点 —— 透多少由用户在外观页的「卡片透明度」决定。
 *
 * 为什么不用 `bg-surface/70` 这种 class：
 * HeroUI 的 `Surface` 把底色写在 CSS 组件类里，和工具类的合并顺序取决于
 * uniwind 的编译顺序，跨版本容易翻车；`style` 一定是最后应用的
 * （uniwind 的 HOC 是 `[classNameStyle, style]`），结果稳定。
 */

import { useThemeColor } from "heroui-native";

import { usePreferences } from "@/hooks/use-preferences";
import { withAlpha } from "@/theme/color";

export function useTranslucentSurface(alpha?: number): { backgroundColor: string } {
  const surface = useThemeColor("surface");
  const { cardOpacity } = usePreferences();
  // 显式传 alpha 时忽略用户偏好（个别地方需要固定的浓度）
  return { backgroundColor: withAlpha(surface, alpha ?? cardOpacity) };
}
