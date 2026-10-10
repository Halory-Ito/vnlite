/**
 * 搜索结果列表壳（制作人员 / 制作者两档共用）。
 *
 * 与 `VnInfiniteList` 是同一套处理：初始加载 / 触底翻页 / 空态 / 错误 / 底部读数，
 * 区别只是行不是 VN 卡片而是 `SearchResultRow`，所以不共用那一个组件
 * （把行渲染做成参数就得改所有调用方，不如各留一份）。
 */

import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import type { JSX } from "react";
import { ActivityIndicator, View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import {
  emptyDescription,
  resultHeadline,
  type SearchEntry,
  type SearchScope,
} from "../search-logic";

import { SearchResultRow } from "./search-result-row";

export interface CatalogResultListProps {
  entries: SearchEntry[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  onRetry: () => void;
  onPressItem: (id: string) => void;
  /** 当前搜索范围，只用在空态文案里：「没有与 x 匹配的制作者」 */
  scope: SearchScope;
  keyword: string;
}

export function CatalogResultList({
  entries,
  isLoading,
  isError,
  error,
  isFetchingNextPage,
  onEndReached,
  onRetry,
  onPressItem,
  scope,
  keyword,
}: CatalogResultListProps): JSX.Element {
  const { t } = useTranslation();

  if (isLoading) return <LoadingState label={t("search.loading")} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (entries.length === 0) {
    return (
      <EmptyState title={t("search.emptyTitle")} description={emptyDescription(keyword, scope)} />
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<SearchEntry>): JSX.Element => (
    <SearchResultRow entry={item} onPress={onPressItem} />
  );

  return (
    // flex-1 不可省：FlashList 默认按内容高度撑开，会溢出到 Tab 栏下方，
    // 把 Tab 栏的触摸事件吃掉（与 VnInfiniteList 同一个坑）
    <FlashList<SearchEntry>
      style={{ flex: 1 }}
      data={entries}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={
        <Muted type="body-xs" className="px-4 pb-1 pt-1">
          {resultHeadline(keyword)}
        </Muted>
      }
      ListFooterComponent={
        <View className="items-center gap-1 py-6">
          {isFetchingNextPage ? (
            <>
              <ActivityIndicator size="small" />
              <Muted type="body-xs">{t("search.loadingMore")}</Muted>
            </>
          ) : null}
        </View>
      }
    />
  );
}
