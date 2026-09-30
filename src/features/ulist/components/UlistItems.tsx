/**
 * 清单条目集合：网格（纯封面墙）与列表（行）两种视图。
 *
 * 两种视图共用同一套分页、下拉刷新与触底加载；只有 `renderItem` 不同。
 * 网格走共用的 `VnCoverGrid`（制作者详情的「作品」页签用的是同一个）；
 * 列表是清单专用的行（行上要显示我的打分 / 状态标签）。
 * 点条目 = 进**作品详情页**（改打分 / 标签走详情页右上角「编辑」）。
 */

import { FlashList } from "@shopify/flash-list";
import type { JSX } from "react";
import { RefreshControl } from "react-native";

import { Separator } from "@/components/Separator";
import { Muted } from "@/components/Typo";
import { VnCoverGrid } from "@/features/vn/components/VnCoverGrid";
import type { UListItem } from "@/lib/api/types";
import type { VnViewMode } from "@/lib/storage/preferences";

import { UlistItemRow } from "./UlistItemRow";

export interface UlistItemsProps {
  mode: VnViewMode;
  items: UListItem[];
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  /** 点条目：进作品详情页（改打分 / 标签走详情页右上角的「编辑」） */
  onPressItem: (vnId: string) => void;
}

export function UlistItems({
  mode,
  items,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
}: UlistItemsProps): JSX.Element {
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;
  const footer = isFetchingNextPage ? (
    <Muted type="body-xs" className="py-4 text-center">
      加载更多…
    </Muted>
  ) : null;

  if (mode === "grid") {
    return (
      <VnCoverGrid
        entries={items.map((item) => ({
          id: item.id,
          title: item.vn?.title ?? item.id,
          image: item.vn?.image,
        }))}
        onPressItem={onPressItem}
        onEndReached={onEndReached}
        refreshControl={refreshControl}
        footer={footer}
      />
    );
  }

  return (
    <FlashList<UListItem>
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <UlistItemRow item={item} onPress={onPressItem} />}
      ItemSeparatorComponent={Separator}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={refreshControl}
      ListFooterComponent={footer}
    />
  );
}
