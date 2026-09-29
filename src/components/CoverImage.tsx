/**
 * 封面图。
 *
 * 统一封装 `expo-image` + NSFW 策略（Q6）：
 *   hide 档 → 敏感图不渲染
 *   blur 档 → 露骨图加 blurRadius
 *   show 档 → 原图
 *
 * **双击切换 censored/uncensored**（借鉴 vndb-lite）：
 * 比「在设置里切三档」好得多 —— 逐图控制、不打断浏览。
 * override 只活在组件内，切列表就重置；全局档位由 `nsfwMode` 决定基线。
 *
 * `expo-image` 的 `width`/`height` 传数组时表示宽高比，但 **React Native 的
 * `View` style 不接受数组**，所以占位分支需要自己算出真实高度。
 */

import { Image, type ImageStyle } from "expo-image";
import * as Haptics from "expo-haptics";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/Muted";
import { useDoubleTap } from "@/hooks/useDoubleTap";
import { useImageGate, useNsfwMode } from "@/hooks/usePreferences";

/** 宽高比写法：`[宽, 高]`，例如 `[62, 82]` 表示 62:82 */
export type SizeSpec = number | readonly [number, number];

/** 把 SizeSpec 解析成实际像素值 */
function resolve(width: SizeSpec, height: SizeSpec): { w: number; h: number } {
  const w = typeof width === "number" ? width : width[0];
  const h = typeof height === "number" ? height : Math.round((w * height[1]) / height[0]);
  return { w, h };
}

export interface CoverImageProps {
  url: string | undefined;
  width: SizeSpec;
  height: SizeSpec;
  sexual?: number;
  violence?: number;
  /** 优先级：列表页默认 "normal"，详情页大图给 "high" */
  priority?: "low" | "normal" | "high";
  roundedClassName?: string;
  style?: ImageStyle;
  accessibilityLabel?: string;
  /** 单击回调（打开图片查看器用）。双击切换敏感内容不受影响 */
  onPress?: () => void;
  /** 关闭双击切换（截图墙、纯展示位用） */
  disableToggle?: boolean;
}

export function CoverImage({
  url,
  width,
  height,
  sexual,
  violence,
  priority = "normal",
  roundedClassName = "rounded-md",
  style,
  accessibilityLabel,
  onPress,
  disableToggle = false,
}: CoverImageProps): JSX.Element {
  const gate = useImageGate({ sexual, violence });
  const nsfwMode = useNsfwMode();
  const [revealed, setRevealed] = useState(false);
  const { w, h } = resolve(width, height);

  const showNsfw = nsfwMode === "show" || revealed;
  // 用户已明确「隐藏」时，双击也不放行 —— 不给绕过全局硬开关的口子
  const canReveal = !disableToggle && gate.isSensitive && nsfwMode !== "hide";
  const hidden = gate.mode === "hide" && gate.isSensitive;
  const blurred = showNsfw ? false : gate.mode === "blur" && gate.level >= 2;

  const placeholder = (
    <View
      className={`items-center justify-center bg-default-soft ${roundedClassName}`}
      style={{ width: w, height: h }}
      accessibilityLabel="暂无封面"
    >
      <Muted type="body-xs" className="text-[10px]">
        无图
      </Muted>
    </View>
  );

  const image = !url ? (
    placeholder
  ) : (
    <Image
      source={url}
      style={style ? [{ width: w, height: h }, style] : { width: w, height: h }}
      contentFit="cover"
      transition={priority === "low" ? 100 : 200}
      priority={priority}
      // `loading` 只在 web 上生效；原生没有 lazy 概念（挂载即入队），
      // 加载顺序由 `priority` 决定。这里写上是为了 web 预览也别偷懒
      loading="eager"
      blurRadius={blurred ? 18 : 0}
      recyclingKey={url}
      accessibilityLabel={accessibilityLabel}
    />
  );

  // 硬隐藏档：不给绕过口子
  if (hidden) return placeholder;
  if (!canReveal && !onPress) return image;

  return (
    <TogglePressable
      onToggle={() => setRevealed((v) => !v)}
      onPress={onPress}
      canReveal={canReveal}
      revealed={revealed}
    >
      {image}
      {blurred ? (
        <View className="absolute inset-0 items-center justify-center">
          <Muted type="body-xs" className="text-[10px] opacity-80">
            双击显示
          </Muted>
        </View>
      ) : null}
    </TogglePressable>
  );
}

/** 双击切换敏感内容 + 单击打开查看器的容器 */
function TogglePressable({
  children,
  onToggle,
  onPress,
  canReveal,
  revealed,
}: {
  children: React.ReactNode;
  onToggle: () => void;
  onPress?: () => void;
  canReveal: boolean;
  revealed?: boolean;
}): JSX.Element {
  const toggle = useCallback(() => {
    if (!canReveal) return;
    void Haptics.selectionAsync();
    onToggle();
  }, [canReveal, onToggle]);
  // 不需要「双击显示」时（非敏感图 / 关掉了切换）不挂双击，单击立刻生效
  const { onPress: handlePress } = useDoubleTap(canReveal ? toggle : undefined, onPress);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="imagebutton"
      accessibilityState={{ selected: revealed }}
      accessibilityHint={canReveal ? "双击可显示或隐藏敏感内容" : undefined}
    >
      {children}
    </Pressable>
  );
}

/** 占位骨架，列表滚动时先占位避免跳动 */
export function CoverSkeleton({
  width,
  height,
  roundedClassName = "rounded-md",
}: {
  width: SizeSpec;
  height: SizeSpec;
  roundedClassName?: string;
}): JSX.Element {
  const { w, h } = resolve(width, height);
  return <View className={`bg-default-soft ${roundedClassName}`} style={{ width: w, height: h }} />;
}
