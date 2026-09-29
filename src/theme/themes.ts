/**
 * 主题包：把 `seeds.ts` 的纯逻辑 + 背景图资源组装成可用的主题定义。
 *
 * 11 套配色与背景图来自 vndb-lite（Apache-2.0），主题名与主/辅色与原项目一致。
 *
 * 与 vndb-lite 的三处差异：
 *   1. **配色是 CSS 变量而非 Flutter Color。** Flutter 会从 seedColor 自动
 *      派生整套 Material 配色，HeroUI Native 不会，必须显式算出 ~26 个 token
 *      （见 `seeds.ts` 的 `deriveTokens`）。
 *   2. **背景图转成 JPEG 并降分辨率。** 原 PNG 627x1121 共 3.86 MB；背景图本来
 *      就会被遮罩压暗甚至模糊，转 720x1288 JPEG q72 后共 0.64 MB（省 83%），
 *      肉眼无差别。
 *   3. **主题不再自带明暗。** 每套主题都要能同时用于亮色和暗色，
 *      用哪个由用户的 `colorScheme` 偏好决定。
 */

import type { ColorSchemePreference } from "@/lib/storage/preferences";
import type { ImageSourcePropType } from "react-native";

import { parseColor, shade, toHex } from "./color";
import { THEME_SEEDS, deriveTokens, type ThemeMode } from "./seeds";

export interface ThemeDefinition {
  id: string;
  name: string;
  /** 品牌主色 */
  primary: string;
  /** 品牌辅色 */
  secondary: string;
  /** 背景图 */
  background: ImageSourcePropType;
}

/**
 * 静态 `require` 让 Metro 能在打包时静态分析到资源。
 * 不能写成 `require(\`.../${seed.image}.jpg\`)` —— 动态路径 Metro 解析不到，
 * 运行时会崩。改任何一个文件名都要同步改这里。
 */
const IMAGES: Record<string, ImageSourcePropType> = {
  agl: require("@/assets/images/themes/agl.jpg"),
  air: require("@/assets/images/themes/air.jpg"),
  carnvl: require("@/assets/images/themes/carnvl.jpg"),
  ev17: require("@/assets/images/themes/ev17.jpg"),
  fate: require("@/assets/images/themes/fate.jpg"),
  hgrshi: require("@/assets/images/themes/hgrshi.jpg"),
  lilbusts: require("@/assets/images/themes/lilbusts.jpg"),
  saya: require("@/assets/images/themes/saya.jpg"),
  seinrkn: require("@/assets/images/themes/seinrkn.jpg"),
  toho: require("@/assets/images/themes/toho.jpg"),
  tsukhme: require("@/assets/images/themes/tsukhme.jpg"),
};

export const THEMES: ThemeDefinition[] = THEME_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  primary: seed.primary,
  secondary: seed.secondary,
  background: IMAGES[seed.id]!,
}));

export const DEFAULT_THEME_ID = "air";

export function getTheme(id: string | undefined): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

/**
 * 把用户偏好解析成**实际生效的**明暗模式。
 *
 * `system` 时要看系统当前是什么；另外两个直接就是结果。
 *
 * @param preference 用户偏好（`"system" | "light" | "dark"`）
 * @param systemScheme 系统当前模式。RN 的 `useColorScheme()` 会返回
 *   `'light' | 'dark' | 'unspecified' | null`，这里只认 `'dark'`，
 *   其余一律当亮色（`'unspecified'` 就是没表态，按最通用的亮色来）
 */
export function resolveMode(
  preference: ColorSchemePreference,
  systemScheme: string | null | undefined
): ThemeMode {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

/**
 * 派生结果的缓存。
 *
 * 主题 × 模式一共 22 种组合，每种约 26 个 token。
 * 不缓存的话每次 `ThemeProvider` 渲染都会重算一遍颜色混合 ——
 * 而拖动遮罩滑杆时它每帧都在渲染。
 */
const tokenCache = new Map<string, Record<string, string>>();

/**
 * 取某套主题在某模式下的 token 表。
 *
 * 同一 (主题, 模式) 返回**同一个对象引用**，这样把它交给
 * `ScopedVariables` 时 `useMemo` 不会因为引用变化而白白重渲染。
 */
export function getTokens(theme: ThemeDefinition, mode: ThemeMode): Record<string, string> {
  const key = `${theme.id}:${mode}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;

  const tokens = deriveTokens(theme.primary, theme.secondary, mode);
  tokenCache.set(key, tokens);
  return tokens;
}

/** 预览用主色。同一主题在两种模式下都可用，亮色下压暗一点更接近实际观感 */
export function themeSwatch(theme: ThemeDefinition, mode: ThemeMode): string {
  return toHex(shade(parseColor(theme.primary), mode === "dark" ? 0 : -0.15));
}

/** 预览用辅色 */
export function themeSwatchAlt(theme: ThemeDefinition, mode: ThemeMode): string {
  return toHex(shade(parseColor(theme.secondary), mode === "dark" ? -0.4 : 0.3));
}
