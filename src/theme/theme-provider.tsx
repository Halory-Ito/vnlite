/**
 * 主题 Provider。
 *
 * 三件事：
 *   1. **明暗模式** —— `Uniwind.setTheme()`。
 *      ⚠️ 之前这里用的是 `Appearance.setColorScheme()`，并在注释里断言
 *      「Uniwind 的 colorScheme 只在初始化时读一次，没有公开 API 强制」——
 *      **这个判断是错的**。`Uniwind.setTheme('light' | 'dark' | 'system')`
 *      就是官方入口：它会同步 `Appearance`、切内部 variant，
 *      并广播 `StyleDependency.Theme` 让所有已解析的样式重新计算
 *      （见 `uniwind/src/core/config/config.common.ts`）。
 *
 *      用 `Appearance` 的后果是：uniwind 的 variant 永远停在冷启动那一刻，
 *      而各类 `@variant light/dark` 的派生值（`*-soft`、`background-secondary`
 *      等）全按错误的模式渲染 —— 表现就是「某些组件颜色和主题对不上」。
 *   2. **配色覆盖** —— `ScopedVariables` 注入 `--xxx` 原始变量。
 *      注意必须覆盖 `--background` 而不是 `--color-background`：
 *      后者在 `@theme inline` 里会被内联进工具类，运行时改无效。
 *   3. **背景图层** —— 绝对定位的三层结构（底色 / 图片 / 遮罩），见 `AppBackground`。
 *
 * 自定义主题只替换「主 / 辅色」这一层输入，其余派生与可读性钳制完全复用内置主题
 * 那套（`deriveTokens` + 冒烟里的对比度断言）。
 *
 * 刻意做成「即使换肤失败，App 仍完全可用」：
 * 变量注入失败只是配色不生效，不会崩。
 */

import type { JSX, ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useColorScheme, View } from "react-native";
import { ScopedVariables, Uniwind } from "uniwind";
import { File } from "expo-file-system";

import { AppBackground } from "@/components/app-background";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { resolveTheme, getTokens, resolveMode } from "./themes";

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const theme = resolveTheme(
    preferences.themeId,
    preferences.customTheme,
    t("settings.themeCustom")
  );
  const systemScheme = useColorScheme();

  /* ---- 明暗模式 ---- */
  // 用户的 colorScheme 偏好就是 Uniwind 的 setTheme 入参，三态直接对应
  const { colorScheme } = preferences;
  useEffect(() => {
    Uniwind.setTheme(colorScheme);
  }, [colorScheme]);

  // 实际生效的模式：`system` 时看系统
  const mode = resolveMode(colorScheme, systemScheme);

  /* ---- 配色覆盖 ---- */
  // 按「两个颜色 + 模式」做依赖：自定义主题每次渲染都会新建对象，
  // 用对象本身当依赖会每帧重算；`getTokens` 内部还有一份按这三项做的缓存。
  const { primary, secondary } = theme;
  const tokens = useMemo(() => getTokens(primary, secondary, mode), [primary, secondary, mode]);

  const content = (
    <ThemeShell
      themeId={preferences.themeId}
      backgroundUrl={preferences.backgroundUrl}
      opacity={preferences.backgroundOpacity}
      blur={preferences.backgroundBlur}
      position={preferences.backgroundPosition}
      showBackground={preferences.showBackground}
    >
      {children}
    </ThemeShell>
  );
  if (Object.keys(tokens).length === 0) return content;
  return <ScopedVariables variables={tokens}>{content}</ScopedVariables>;
}

/**
 * 背景 + 内容的壳。
 *
 * 最外层 `View` 是整棵树的定位上下文：背景三图层绝对定位在它里面，
 * 内容再叠在上面。**这里不要给底色** —— 底色已经是背景图层的一部分了，
 * 在这里再刷一次不透明色等于把背景图盖回去（这正是之前看不见图的原因）。
 */
function ThemeShell({
  themeId,
  backgroundUrl,
  opacity,
  blur,
  position,
  showBackground,
  children,
}: {
  themeId: string;
  /** 用户自定义背景图，优先级高于主题自带 */
  backgroundUrl: string | null;
  opacity: number;
  blur: number;
  /** 背景图位置（0–1），只挪动被 cover 裁掉的部分 */
  position: { x: number; y: number };
  /** 是否显示背景图 */
  showBackground: boolean;
  children: ReactNode;
}): JSX.Element {
  const theme = resolveTheme(themeId);
  // 同步的文件存在性检查只做一次：每次渲染都问一次原生层没必要
  const custom = useMemo(
    () => (showBackground ? usableBackgroundUrl(backgroundUrl) : null),
    [showBackground, backgroundUrl]
  );
  const source = showBackground ? (custom ?? theme.background) : null;

  return (
    <View style={{ flex: 1 }}>
      <AppBackground source={source} opacity={opacity} blur={blur} position={position} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/**
 * 本地背景图还在不在。
 *
 * 偏好会随 WebDAV 备份同步到新设备，但图片文件本身不会 —— 那份
 * `file://` 地址在新机上指向一个不存在的文件，直接渲染就是「背景全黑」。
 * 这里做一次存在性检查，不在就回落到主题自带背景。
 */
function usableBackgroundUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith("file://")) return url;
  try {
    return new File(url).exists ? url : null;
  } catch {
    return null;
  }
}
