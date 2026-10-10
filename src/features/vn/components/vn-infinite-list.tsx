/**
 * 无限滚动的 VN 列表。
 *
 * 用 FlashList（已装，Expo Go 兼容）而不是 FlatList：条目高度接近固定，
 * 回收复用比 FlatList 好很多。
 *
 * 统一处理：初始加载 / 触底翻页 / 空态 / 错误 / 登录后失效重取。
 */

import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import type { JSX, ReactElement, ReactNode, Ref } from "react";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Separator } from "@/components/separator";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";

import { VnListItem } from "./vn-list-item";

export interface VnInfiniteListProps {
  items: VnSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  onRetry: () => void;
  onPressItem: (id: string) => void;
  /** 列表为空时的提示 */
  emptyTitle?: string;
  emptyDescription?: string;
  /** 列表顶部插槽（筛选摘要等） */
  header?: ReactNode;
  /** 外部 ref，供「回到顶部」使用 */
  listRef?: Ref<FlashListRef<VnSummary>>;
}

export function VnInfiniteList({
  items,
  isLoading,
  isError,
  error,
  isFetchingNextPage,
  onEndReached,
  onRetry,
  onPressItem,
  emptyTitle,
  emptyDescription,
  header,
  listRef,
}: VnInfiniteListProps): JSX.Element {
  const { t } = useTranslation();
  // 封面查看器：null = 关着。挂在列表这一层，整页只用一个 Modal
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // 可放大的封面（没图的条目本来就没得看），顺便记下 id → 下标
  const { covers, coverIndex } = useMemo(() => {
    const images: ViewerImage[] = [];
    const index = new Map<string, number>();
    for (const vn of items) {
      const url = vn.image?.url;
      if (!url) continue;
      index.set(vn.id, images.length);
      images.push({
        url,
        thumbnail: vn.image?.thumbnail,
        dims: vn.image?.dims,
        sexual: vn.image?.sexual,
        violence: vn.image?.violence,
        label: t("home.coverLabel", { title: vn.title }),
      });
    }
    return { covers: images, coverIndex: index };
  }, [items, t]);

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (items.length === 0) {
    return <EmptyState title={emptyTitle ?? t("vn.listEmpty")} description={emptyDescription} />;
  }

  const renderItem = ({ item }: ListRenderItemInfo<VnSummary>): ReactElement => (
    <View>
      <VnListItem
        vn={item}
        onPress={onPressItem}
        onCoverPress={() => setViewerIndex(coverIndex.get(item.id) ?? null)}
      />
      <Separator />
    </View>
  );

  return (
    <View className="flex-1">
      <FlashList<VnSummary>
        /*
         * flex-1 不可省：FlashList 默认按内容高度撑开，会溢出到 Tab 栏下方，
         * 把 Tab 栏的触摸事件全吃掉 —— 表现为「进了浏览页就切不了 Tab」。
         */
        style={{ flex: 1 }}
        ref={listRef as never}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={header ? <View className="pt-1">{header}</View> : null}
        // 底部：还有下一页显示转圈，没有了显示已加载数量
        ListFooterComponent={
          <View className="items-center gap-1 py-6">
            {isFetchingNextPage ? (
              <>
                <ActivityIndicator size="small" />
                <Muted type="body-xs">{t("common.loadingMore")}</Muted>
              </>
            ) : null}
          </View>
        }
      />

      <ImageViewer
        images={covers}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
    </View>
  );
}
