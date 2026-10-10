/**
 * 收藏开关按钮（详情页用）。
 *
 * 点一下切换「已收藏 / 未收藏」，写入本地库（VNDB 没有通用收藏端点，见
 * `lib/db/dao/favorite`）。星标：未收藏为描边 `star`，已收藏为实心 `starFill`。
 *
 * 两种外观：
 *   - 只显示星标（默认）—— 放在详情页顶栏，与返回 / 其它操作并排
 *   - `showLabel` —— 星标 + 「收藏 / 已收藏」文字
 */

import { useToast, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";

import { Icon } from "@/components/icon";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { FavoriteType } from "@/lib/db/dao/favorite";

import { useToggleFavorite } from "../hooks";

export interface FavoriteButtonProps {
  type: FavoriteType;
  entryId: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  /** 显示「收藏 / 已收藏」文字，默认只显示星标图标 */
  showLabel?: boolean;
}

export function FavoriteButton({
  type,
  entryId,
  title,
  subtitle,
  imageUrl,
  showLabel = false,
}: FavoriteButtonProps): JSX.Element {
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isFavorite, toggle, isPending, isLoading } = useToggleFavorite(type, entryId, {
    title,
    subtitle,
    imageUrl,
  });

  const busy = isPending || isLoading;
  const disabled = !entryId || busy;

  const onPress = (): void => {
    toggle({
      onSuccess: () =>
        toast.show(isFavorite ? t("favorite.removedToast") : t("favorite.addedToast")),
      onError: () => toast.show(t("common.failed")),
    });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${
        disabled ? "opacity-50" : "active:opacity-70"
      }`}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? t("favorite.removeLabel") : t("favorite.addLabel")}
      accessibilityState={{ selected: isFavorite, disabled }}
    >
      <Icon
        name={isFavorite ? "starFill" : "star"}
        size={showLabel ? 16 : 20}
        color={isFavorite ? accent : muted}
      />
      {showLabel ? (
        <Muted type="body-sm" className={isFavorite ? "text-accent" : "text-muted"}>
          {isFavorite ? t("favorite.favorited") : t("favorite.favorite")}
        </Muted>
      ) : null}
    </Pressable>
  );
}
