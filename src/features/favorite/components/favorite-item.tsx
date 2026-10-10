/**
 * 收藏行。
 *
 * 布局与浏览历史行共用 `EntryListItem`，这里只负责「取路由、长按取消收藏」，
 * 兜底图标改成星标（收藏语义）。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { EntryListItem } from "@/components/entry-list-item";
import { useKungalNameLogo } from "@/features/catalog/use-kungal-logo";
import { useTranslation } from "@/hooks/use-translation";
import type { FavoriteEntry } from "@/lib/db/dao/favorite";
import { formatRelativeTime } from "@/utils/format";

import { FAVORITE_TYPE_ROUTE } from "../favorite-constants";

export interface FavoriteItemProps {
  entry: FavoriteEntry;
  onRemove: (entry: FavoriteEntry) => void;
}

export function FavoriteItem({ entry, onRemove }: FavoriteItemProps): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const accent = useThemeColor("accent");
  // 厂商条目兜底补 LOGO（老收藏没存图片；新收藏在详情页 / 收藏按钮已写入）
  const isProducer = entry.type === "producer";
  const fallbackLogo = useKungalNameLogo(
    isProducer ? entry.title : null,
    isProducer ? entry.subtitle : null
  );

  return (
    <EntryListItem
      title={entry.title}
      subtitle={entry.subtitle}
      timestamp={formatRelativeTime(entry.favoritedAt)}
      imageUrl={entry.imageUrl ?? fallbackLogo}
      imageIsSafe={isProducer}
      fallbackIcon="star"
      fallbackIconColor={accent}
      onPress={() =>
        router.push({
          pathname: FAVORITE_TYPE_ROUTE[entry.type],
          params: { id: entry.entryId },
        })
      }
      onLongPress={() => onRemove(entry)}
      accessibilityHint={t("favorite.longPressRemove")}
    />
  );
}
