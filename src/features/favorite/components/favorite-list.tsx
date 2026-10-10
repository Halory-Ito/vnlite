/**
 * 收藏集合：网格（纯封面墙）与列表（行）两种视图。
 *
 * 只有**作品档**支持网格 —— 人员 / 用户 / 厂商没有稳定的封面。
 * 网格复用共用的 `VnCoverGrid`，列表复用 `FavoriteItem`（带收藏时间、长按取消）。
 */

import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import type { JSX, ReactElement } from "react";
import { ActivityIndicator, View } from "react-native";

import { Separator } from "@/components/separator";
import { Muted } from "@/components/typo";
import { VnCoverGrid } from "@/features/vn/components/vn-cover-grid";
import { useTranslation } from "@/hooks/use-translation";
import type { FavoriteEntry } from "@/lib/db/dao/favorite";

import { FavoriteItem } from "./favorite-item";

export interface FavoriteListProps {
  entries: FavoriteEntry[];
  /** 网格视图（仅作品档） */
  grid: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  onRemove: (entry: FavoriteEntry) => void;
}

export function FavoriteList({
  entries,
  grid,
  isFetchingNextPage,
  onEndReached,
  onRemove,
}: FavoriteListProps): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();

  const footer = (
    <View className="items-center gap-1 py-6">
      {isFetchingNextPage ? (
        <>
          <ActivityIndicator size="small" />
          <Muted type="body-xs">{t("favorite.loadingMore")}</Muted>
        </>
      ) : null}
    </View>
  );

  if (grid) {
    return (
      <VnCoverGrid
        entries={entries.map((entry) => ({
          id: entry.entryId,
          title: entry.title,
          image: entry.imageUrl ? { url: entry.imageUrl, thumbnail: entry.imageUrl } : undefined,
        }))}
        onPressItem={(id) => router.push({ pathname: "/vn/[id]", params: { id } })}
        onEndReached={onEndReached}
        footer={footer}
      />
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<FavoriteEntry>): ReactElement => (
    <View>
      <FavoriteItem entry={item} onRemove={onRemove} />
      <Separator inset={78} />
    </View>
  );

  return (
    <FlashList<FavoriteEntry>
      /* flex-1 不可省：FlashList 默认按内容高度撑开，会盖住下方内容 */
      style={{ flex: 1 }}
      data={entries}
      renderItem={renderItem}
      keyExtractor={(item) => `${item.type}-${item.entryId}`}
      onEndReachedThreshold={0.6}
      onEndReached={onEndReached}
      ListFooterComponent={footer}
    />
  );
}
