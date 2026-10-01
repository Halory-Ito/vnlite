/**
 * 全局背景图层。
 *
 * 自下而上三层：
 *   1. **底色层** —— 主题 `background` 纯色，永远在最底。
 *      它的存在让上层所有容器都能安全地设成透明（图片没加载完时也不会闪白），
 *      同时它是遮罩的目标色。
 *   2. **图片层** —— 铺满的 `Image`（`contentFit="cover"`），可调 `blurRadius`。
 *   3. **遮罩层** —— 纯色 + 可调 `opacity`，把图片往底色方向拉。
 *
 * 为什么不直接给 `bg-background` 加透明度：那样会让所有前景色也跟着变淡，
 * 文字对比度不可控。单独一层遮罩更可控 —— 强度就是 `opacity` 这一个参数。
 *
 * ⚠️ 关键约束：**本组件之上的所有容器必须是透明的**。
 * `app/_layout.tsx` 的 SafeArea / Stack contentStyle、`(tabs)/_layout.tsx` 的
 * tabBarStyle 早期都刷了不透明 `background`，把这里的图整个盖住了，
 * 表现为「切了主题但看不见背景图」。改这三处前先看本文件注释。
 *
 * 性能：全屏常驻图片会加重 GPU 合成。图片已预压成 720x1288 JPEG（0.64 MB 全套），
 * 这里再用 `priority="low"` 避免和列表封面抢解码队列。
 */

import { useThemeColor } from "heroui-native";
import { Image } from "expo-image";
import type { JSX } from "react";
import { StyleSheet, View, type ImageSourcePropType } from "react-native";

export interface AppBackgroundProps {
  /** 本地 asset（require 的结果）或远程 URL；null = 不渲染图片层 */
  source: ImageSourcePropType | string | null;
  /** 遮罩不透明度 0–1 */
  opacity: number;
  /** 图片模糊半径（pt），0 = 不模糊 */
  blur: number;
}

/** 铺满父容器。三个图层共用，省掉重复的内联样式 */
const FILL = StyleSheet.absoluteFill;

export function AppBackground({ source, opacity, blur }: AppBackgroundProps): JSX.Element {
  const background = useThemeColor("background");
  const blurRadius = blur > 0 ? blur : undefined;

  return (
    // pointerEvents="none"：整组都是装饰，必须让触摸穿透到下面的内容
    <View style={FILL} pointerEvents="none">
      {/* 1. 底色层：永远在最底，保证上层容器可以放心透明 */}
      <View style={[FILL, { backgroundColor: background }]} />

      {/* 2. 图片层 */}
      {source ? (
        <Image
          source={source}
          style={FILL}
          contentFit="cover"
          blurRadius={blurRadius}
          cachePolicy="memory-disk"
          priority="low"
          transition={250}
          accessibilityIgnoresInvertColors
          // 纯装饰，无障碍里必须隐藏
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}

      {/* 3. 遮罩层：把图片往底色方向拉，foreground 与底色的对比度才可控 */}
      {opacity > 0 ? <View style={[FILL, { backgroundColor: background, opacity }]} /> : null}
    </View>
  );
}
