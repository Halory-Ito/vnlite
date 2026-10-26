/**
 * 自定义主题的**纯逻辑**部分：id、默认配色、色值校验。
 *
 * 与 `seeds.ts` 一样单独成一个文件：`lib/storage/preferences` 依赖 AsyncStorage，
 * 而 `theme/themes` 要能在 Metro 之外被引用（冒烟脚本）。这里只留纯函数与常量。
 *
 * ## 自定义主题是什么
 *
 * - **颜色**：用户自己挑主色 / 辅色，其余 token 仍由 `deriveTokens` 按对比度推导
 * - **背景图**：沿用全局的 `backgroundUrl`（本地文件或远程 URL）
 *
 * 换句话说，自定义主题不是「一张完整的配色表」，而是「换一组品牌色」——
 * 这样可读性钳制、明暗两套派生都还能沿用同一套保证。
 */

/** 自定义主题在 `themeId` 里的取值 */
export const CUSTOM_THEME_ID = "custom";

/** 自定义主题的品牌色 */
export interface CustomThemeColors {
  primary: string;
  secondary: string;
}

/** 默认配色：取自 Ever17 的青色 + 橙色，明暗两套下都不扎眼 */
export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  primary: "#6EC8D2",
  secondary: "#F0AA64",
};

/** 是否是可用的十六进制色（`#rgb` / `#rrggbb`） */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * 把用户输入的色值规整成 `#rrggbb`。
 *
 * 合法就返回小写六位；不合法返回 null（调用方保留上一个有效值）。
 * 三位简写会展开成六位 —— HeroUI 的 token 与 `parseColor` 都按六位处理。
 */
export function normalizeHexColor(input: string): string | null {
  const value = input.trim();
  if (!isHexColor(value)) return null;
  const hex = value.slice(1).toLowerCase();
  if (hex.length === 6) return `#${hex}`;
  return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
}
