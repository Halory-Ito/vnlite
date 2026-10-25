/**
 * 圆形头像：有图就画图，没有就画**用户名首字母**（游客态画人形图标）。
 *
 * 头像文件在 `document` 目录（见 `../avatar`），用 `expo-image` 渲染 ——
 * 它按 URI 做磁盘缓存，`avatar.ts` 每次换头像都换文件名，所以不会显示旧图。
 */

import { Image } from "expo-image";
import { Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";

export interface AvatarProps {
  /** 边长（dp） */
  size: number;
  /** 本地头像 URI；null 走字母 / 图标兜底 */
  uri: string | null;
  /** 用户名首字母（已大写）；没有就画人形图标 */
  initial?: string | null;
}

export function Avatar({ size, uri, initial }: AvatarProps): JSX.Element {
  const accent = useThemeColor("accent");
  const radius = size / 2;

  return (
    <View
      className="items-center justify-center overflow-hidden bg-accent-soft"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={120}
        />
      ) : initial ? (
        <Typography type="h4" className="text-accent">
          {initial}
        </Typography>
      ) : (
        <Icon name="person" size={Math.round(size * 0.46)} color={accent} />
      )}
    </View>
  );
}
