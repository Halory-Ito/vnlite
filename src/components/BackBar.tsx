/**
 * 二级页返回栏。
 *
 * 详情页原来各写一份「返回箭头 + 可选标题」，这里统一：箭头颜色取主题 `muted`
 * （写死 iOS 系统灰 `#8E8E93` 换主题后对不上，踩过）。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/Icon";
import { H5 } from "@/components/Typo";

export interface BackBarProps {
  title?: string;
  /** 不传就 `router.back()` */
  onPress?: () => void;
}

export function BackBar({ title, onPress }: BackBarProps): JSX.Element {
  const router = useRouter();
  const muted = useThemeColor("muted");

  return (
    <View className="flex-row items-center gap-2 px-4 py-2">
      <Pressable
        onPress={onPress ?? (() => router.back())}
        className="active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel="返回"
        hitSlop={8}
      >
        <Icon name="chevronLeft" size={24} color={muted} />
      </Pressable>
      {title ? (
        <H5 numberOfLines={1} className="flex-1">
          {title}
        </H5>
      ) : null}
    </View>
  );
}
