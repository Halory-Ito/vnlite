/**
 * 系统悬浮球里渲染的组件（Android）。
 *
 * ⚠️ 它由 `react-native-android-overlay` 通过 **AppRegistry** 独立挂载，
 * **不在** App 的 Provider 树里（没有 HeroUI / ThemeProvider / SafeArea）。
 * 所以这里：
 *   - 只用 RN 原生 `View` / `Text`，不引用 HeroUI 组件
 *   - 配色自己从主题 token 取（`getTokens` + 偏好），不依赖 `useThemeColor`
 *   - 数据仍走同一个模块级 store（同一 JS 运行时），所以时间是实时的
 *
 * 注册见根目录 `index.js`。
 */

import type { JSX } from "react";
import { Appearance, Text, View } from "react-native";

import { getPreferences } from "@/lib/storage/preferences";
import { getTheme, getTokens, resolveMode } from "@/theme/themes";

import { formatGameDuration } from "../format";
import { useElapsedMs, useGameTimer } from "../hooks";

const SIZE = 84;

export function GameTimerOverlayWindow(): JSX.Element | null {
  const timer = useGameTimer();
  const elapsed = useElapsedMs();

  if (timer.status === "idle") return null;

  const paused = timer.status === "paused";
  const preferences = getPreferences();
  const tokens = getTokens(
    getTheme(preferences.themeId),
    resolveMode(preferences.colorScheme, Appearance.getColorScheme())
  );
  const accent = tokens["--accent"] ?? "#2d9cdb";
  const accentForeground = tokens["--accent-foreground"] ?? "#ffffff";

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: paused ? "#1f1f1fcc" : accent,
          borderWidth: 1,
          borderColor: "#00000022",
        }}
      >
        <Text
          style={{
            color: paused ? "#ffffff" : accentForeground,
            fontSize: 13,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatGameDuration(elapsed)}
        </Text>
      </View>
    </View>
  );
}
