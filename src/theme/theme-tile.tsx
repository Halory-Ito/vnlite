/**
 * 主题选择卡片。
 *
 * 每个 tile 展示该主题的**真实背景图**（缩略）+ 主/辅色块 + 名称。
 *
 * ⚠️ 主题不再自带明暗属性 —— 每套主题在亮色和暗色下都能用，
 * 所以色块要按**当前生效的模式**取色，否则用户会以为「这套主题是暗的」。
 */

import { Image } from "expo-image";
import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import type { ThemeMode } from "@/theme/seeds";
import { themeSwatch, themeSwatchAlt, type ThemeDefinition } from "@/theme/themes";
export interface ThemeTileProps {
  theme: ThemeDefinition;
  active: boolean;
  /** 当前生效的明暗模式，决定色块取值 */
  mode: ThemeMode;
  onPress: () => void;
}

export function ThemeTile({ theme, active, mode, onPress }: ThemeTileProps): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className={`w-[30%] overflow-hidden rounded-lg border-2 active:opacity-70 ${
        active ? "border-accent" : "border-border"
      }`}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${theme.name}，当前${mode === "dark" ? "暗色" : "亮色"}模式`}
    >
      {/* 背景图缩略 */}
      <View className="h-16 w-full">
        <Image
          source={theme.background}
          style={{ width: "100%", height: 64 }}
          contentFit="cover"
          transition={120}
          priority="low"
          accessibilityIgnoresInvertColors
        />
      </View>

      {/* 配色条：主色 + 辅色 */}
      <View className="flex-row h-1.5">
        <View style={{ flex: 1, backgroundColor: themeSwatch(theme, mode) }} />
        <View style={{ flex: 1, backgroundColor: themeSwatchAlt(theme, mode) }} />
      </View>

      <View className="gap-0.5 px-1.5 py-1.5">
        <Typography
          type="body-xs"
          className={`text-[10px] ${active ? "text-accent" : ""}`}
          numberOfLines={2}
        >
          {theme.name}
        </Typography>
      </View>
    </Pressable>
  );
}
