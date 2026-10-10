/**
 * 搜索页 · 作品档的结果。
 *
 * 走 `search` 过滤器，因此可以用 `searchrank` 排序（VNDB 限制：只有顶层过滤器
 * 是 `search` 时该排序才可用 —— 详见 `compileVnFilters`）。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";

import { Muted } from "@/components/typo";
import { VnInfiniteList } from "@/features/vn/components/vn-infinite-list";
import { flattenPages, useVnList } from "@/features/vn/hooks";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";

import { emptyDescription, resultHeadline } from "../search-logic";

export function VnSearchResults({ keyword }: { keyword: string }): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();

  const query = useVnList({
    filters: { search: keyword },
    sort: "searchrank",
    reverse: false,
    enabled: keyword.length > 0,
  });
  const items = flattenPages<VnSummary>(query.data?.pages);

  return (
    <VnInfiniteList
      items={items}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      hasNextPage={query.hasNextPage ?? false}
      isFetchingNextPage={query.isFetchingNextPage}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onRetry={() => void query.refetch()}
      onPressItem={(id) => router.push(`/vn/${id}`)}
      emptyTitle={t("search.vnEmptyTitle")}
      emptyDescription={emptyDescription(keyword, "vn")}
      header={
        <Muted type="body-xs" className="px-4 pb-1">
          {resultHeadline(keyword)}
        </Muted>
      }
    />
  );
}
