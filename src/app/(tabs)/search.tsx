/**
 * 搜索页。
 *
 * 搜索走 `search` 过滤器，因此可以用 `searchrank` 排序（VNDB 限制：
 * 只有顶层过滤器是 `search` 时该排序才可用 —— 详见 `compileVnFilters`）。
 * 输入防抖 350ms，避免每敲一个字就打一次接口。
 */

import { useRouter } from "expo-router";
import { SearchField } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/ScreenState";
import { Muted } from "@/components/Typo";
import { VnInfiniteList } from "@/features/vn/components/VnInfiniteList";
import { flattenPages, useVnList } from "@/features/vn/hooks";
import { queryTags } from "@/lib/api/endpoints/catalog";
import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import type { VnSummary } from "@/lib/api/types";
import { formatCount } from "@/utils/format";

const DEBOUNCE_MS = 350;

export default function SearchTab(): JSX.Element {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [input]);

  const query = useVnList({
    filters: debounced ? { search: debounced } : undefined,
    sort: "searchrank",
    reverse: false,
    enabled: debounced.length > 0,
  });

  const items = flattenPages<VnSummary>(query.data?.pages);

  return (
    <View className="flex-1">
      <View className="gap-3 px-4 pt-1">
        <SearchField value={input} onChange={(value) => setInput(value)}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </View>

      {debounced.length === 0 ? (
        <ScrollView className="flex-1 px-4 pt-3">
          <Muted type="body-xs" className="mb-2 font-medium">
            热门标签
          </Muted>
          <HotTags onPress={(id) => router.push(`/tag/${id}`)} />
        </ScrollView>
      ) : (
        <View className="flex-1 pt-2">
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
            emptyTitle="没有找到"
            emptyDescription={`没有与「${debounced}」匹配的作品`}
            header={
              <Muted type="body-xs" className="px-4 pb-1">
                搜索「{debounced}」的结果
              </Muted>
            }
          />
        </View>
      )}
    </View>
  );
}

/** 热门标签：按 vn_count 降序 */
function HotTags({ onPress }: { onPress: (id: string) => void }): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tag.list(undefined, 1),
    queryFn: () => queryTags({ results: 20, sort: "vn_count", reverse: true }),
    staleTime: STALE_TIME.taxonomy,
    select: (d) => d.results,
  });

  if (isLoading || !data || data.length === 0) {
    return <EmptyState title="标签加载中…" className="py-8" />;
  }

  return (
    <View className="flex-row flex-wrap gap-1.5 pb-6">
      {data.map((tag) => (
        <Pressable
          key={tag.id}
          onPress={() => onPress(tag.id)}
          className="flex-row items-center gap-1.5 rounded-full bg-default-soft px-3 py-1.5 active:opacity-60"
        >
          <Muted type="body-sm">{tag.name}</Muted>
          <Muted type="body-xs" className="text-[10px] opacity-60">
            {formatCount(tag.vn_count)}
          </Muted>
        </Pressable>
      ))}
    </View>
  );
}
