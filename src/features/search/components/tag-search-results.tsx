/**
 * 搜索页 · 标签档。
 *
 * 搜的是**标签本身**（`/tag?search=`），点一行进标签详情页 ——
 * 那个页面会列出这个标签下的作品，等于「按标签找作品」。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { useMemo } from "react";

import { useTagSearch } from "@/features/search/hooks";
import { toTagEntries } from "@/features/search/lib/search-logic";

import { CatalogResultList } from "./catalog-result-list";

export function TagSearchResults({ keyword }: { keyword: string }): JSX.Element {
  const router = useRouter();
  const query = useTagSearch(keyword);
  const entries = useMemo(() => toTagEntries(query.data?.pages), [query.data]);

  return (
    <CatalogResultList
      entries={entries}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      isFetchingNextPage={query.isFetchingNextPage}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onRetry={() => void query.refetch()}
      onPressItem={(id) => router.push(`/tag/${id}`)}
      scope="tag"
      keyword={keyword}
    />
  );
}
