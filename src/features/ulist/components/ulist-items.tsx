/**
 * 清单条目集合：网格（纯封面墙）与列表（行）两种视图。
 *
 * 两种视图共用同一套分页、下拉刷新与触底加载；只有 `renderItem` 不同。
 * 网格走共用的 `VnCoverGrid`（制作者详情的「作品」页签用的是同一个）；
 * 列表是清单专用的行（行上要显示我的打分 / 状态标签）。
 * 点条目 = 进**作品详情页**（改打分 / 标签走详情页右上角「编辑」）。
 *
 * `footer` 是调用方塞在列表底部的额外内容（筛选态的「已加载 N 条里筛出 M 条 +
 * 加载更多」），两种视图都要能带 —— 网格那个的 footer 位置被内部占用了，
 * 所以这里把两处都接上。
 */

import { FlashList } from "@shopify/flash-list";
import type { JSX, ReactElement } from "react";
import { RefreshControl, View } from "react-native";

import { Separator } from "@/components/separator";
import { Muted } from "@/components/typo";
import { VnCoverGrid } from "@/features/vn/components/vn-cover-grid";
import { useTranslation } from "@/hooks/use-translation";
import type { UListItem } from "@/lib/api/types";
import type { VnViewMode } from "@/lib/storage/preferences";

import { UlistItemRow } from "./ulist-item-row";

export interface UlistItemsProps {
  mode: VnViewMode;
  items: UListItem[];
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  /** 点条目：进作品详情页（改打分 / 标签走详情页右上角的「编辑」） */
  onPressItem: (vnId: string) => void;
  /** 列表底部附加内容（筛选说明 + 加载更多）。要单个元素，`VnCoverGrid` 只吃这种 */
  footer?: ReactElement | null;
}

export function UlistItems({
  mode,
  items,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
  footer,
}: UlistItemsProps): JSX.Element {
  const { t } = useTranslation();
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;
  // 「加载更多…」与调用方的附加内容（筛选说明）互斥显示，避免两块提示叠在一起
  const bottom: ReactElement | null = isFetchingNextPage ? (
    <View className="py-4">
      <Muted type="body-xs" className="text-center">
        {t("ulist.loadingMore")}
      </Muted>
    </View>
  ) : (
    (footer ?? null)
  );

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
        footer={bottom}
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
      ListFooterComponent={bottom}
    />
  );
}
