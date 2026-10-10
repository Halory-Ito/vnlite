/**
 * 「封面 / 头像 + 标题 + 副标题 + 时间」的条目行。
 *
 * 浏览历史与收藏两个列表行的结构完全一致（只是时间语义与兜底图标不同），
 * 抽成一份，避免两处各写一遍、改一处漏一处。点进详情页，长按执行 `onLongPress`。
 *
 * 没有图片的条目用兜底图标（历史用 `clock`，收藏用 `star`）。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import type { ColorValue } from "react-native";
import { Pressable, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Icon, type IconName } from "@/components/icon";
import { Muted, Paragraph } from "@/components/typo";

export interface EntryListItemProps {
  onPress: () => void;
  title: string;
  subtitle?: string | null;
  /** 右侧时间文案（相对时间等），为空则不显示 */
  timestamp?: string | null;
  imageUrl?: string | null;
  /**
   * 图不参与 NSFW 处理（厂商 LOGO 这类非敏感图）。
   *
   * 历史 / 收藏条目只存了图片 URL、没有 `sexual` / `violence` 分级，
   * `CoverImage` 会按最保守策略处理（blur 档糊住、hide 档不渲染）——
   * 厂商 LOGO 不属于敏感内容，用这个开关直接以「安全」分级渲染。
   */
  imageIsSafe?: boolean;
  /** 无图时的兜底图标 */
  fallbackIcon: IconName;
  /** 兜底图标颜色，默认主题 `muted` */
  fallbackIconColor?: ColorValue;
  /** 长按回调（如删除 / 取消收藏） */
  onLongPress?: () => void;
  /** 读屏用的长按提示 */
  accessibilityHint?: string;
}

export function EntryListItem({
  onPress,
  title,
  subtitle,
  timestamp,
  imageUrl,
  imageIsSafe = false,
  fallbackIcon,
  fallbackIconColor,
  onLongPress,
  accessibilityHint,
}: EntryListItemProps): JSX.Element {
  const muted = useThemeColor("muted");

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      className="flex-row items-center gap-3 px-4 py-2.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
    >
      {imageUrl ? (
        <CoverImage
          url={imageUrl}
          width={48}
          height={[48, 64]}
          /* 显式给「安全」分级：厂商 LOGO 这类图不参与 NSFW 处理 */
          sexual={imageIsSafe ? 0 : undefined}
          violence={imageIsSafe ? 0 : undefined}
          roundedClassName="rounded-md"
          priority="low"
        />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-md bg-default-soft">
          <Icon name={fallbackIcon} size={20} color={fallbackIconColor ?? muted} />
        </View>
      )}

      <View className="flex-1 justify-center gap-0.5">
        <Paragraph className="line-clamp-1 font-medium" selectable={false}>
          {title}
        </Paragraph>
        {/* 原名与显示名相同时不重复占一行 */}
        {subtitle && subtitle !== title ? (
          <Muted type="body-xs" className="line-clamp-1">
            {subtitle}
          </Muted>
        ) : null}
      </View>

      {timestamp ? (
        <Muted type="body-xs" className="text-[10px] opacity-60">
          {timestamp}
        </Muted>
      ) : null}
    </Pressable>
  );
}
