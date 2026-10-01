/**
 * 搜索页 · 制作人员 / 制作者两档的结果。
 *
 * 两个端点的返回结构一致（`id` + `name` + `original`），所以共用 `CatalogResultList`；
 * 差别只有「怎么查」和「右侧显示什么」，后者由 `to*Entries` 决定。
 * 各自一个子组件 —— 不能在同一个组件里按条件调不同的 hook。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { useMemo } from "react";

import { useProducerSearch, useStaffSearch } from "../hooks";
import { SCOPE_NOUN, toProducerEntries, toStaffEntries } from "../search-logic";

import { CatalogResultList } from "./catalog-result-list";

export function CatalogSearchResults({
  scope,
  keyword,
}: {
  scope: "staff" | "producer";
  keyword: string;
}): JSX.Element {
  return scope === "staff" ? (
    <StaffResults keyword={keyword} />
  ) : (
    <ProducerResults keyword={keyword} />
  );
}

/* -------------------------------------------------------------------------- */
/* 制作人员                                                                    */
/* -------------------------------------------------------------------------- */

function StaffResults({ keyword }: { keyword: string }): JSX.Element {
  const router = useRouter();
  const query = useStaffSearch(keyword);
  const entries = useMemo(() => toStaffEntries(query.data?.pages), [query.data]);

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
      onPressItem={(id) => router.push(`/staff/${id}`)}
      noun={SCOPE_NOUN.staff}
      keyword={keyword}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 制作者                                                                      */
/* -------------------------------------------------------------------------- */

function ProducerResults({ keyword }: { keyword: string }): JSX.Element {
  const router = useRouter();
  const query = useProducerSearch(keyword);
  const entries = useMemo(() => toProducerEntries(query.data?.pages), [query.data]);

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
      onPressItem={(id) => router.push(`/producer/${id}`)}
      noun={SCOPE_NOUN.producer}
      keyword={keyword}
    />
  );
}
