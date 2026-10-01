/**
 * 首页两档「发售」页签（即将发售 / 最新上架）。
 *
 * 两档只有查询不同（`released >` 今天 / `<=` 今天），渲染完全一样，
 * 所以共用一个 `FeedCarousel` 外壳，只把 items 和空态文案换掉。
 *
 * ⚠️ 端点层必须带 `released` 过滤器：`TBA` 在 Kana 里按「最大」参与排序，
 * 只写 `sort: "released"` 的话 TBA 会把整页占满（见 `lib/api/endpoints/vn`）。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/typo";
import type { VnSummary } from "@/lib/api/types";

import { useJustReleasedVns, useUpcomingVns } from "../hooks";

import { CarouselSkeleton, VnCoverCarousel } from "./vn-cover-carousel";

/** 「即将发售」页签 */
export function UpcomingCarousel(): JSX.Element {
  const router = useRouter();
  const query = useUpcomingVns();
  return (
    <FeedCarousel
      items={query.data ?? []}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onPressItem={(id) => router.push(`/vn/${id}`)}
      emptyText="没有即将发售的作品"
    />
  );
}

/** 「最新上架」页签 */
export function JustReleasedCarousel(): JSX.Element {
  const router = useRouter();
  const query = useJustReleasedVns();
  return (
    <FeedCarousel
      items={query.data ?? []}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onPressItem={(id) => router.push(`/vn/${id}`)}
      emptyText="没有新发售的作品"
    />
  );
}

function FeedCarousel({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  onPressItem,
  emptyText,
}: {
  items: readonly VnSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onPressItem: (id: string) => void;
  emptyText: string;
}): JSX.Element {
  if (isLoading) return <CarouselSkeleton />;
  if (isError) {
    return (
      <View className="items-center gap-2 px-6 py-6">
        <Muted type="body-sm" className="text-center">
          加载失败：{error instanceof Error ? error.message : "未知错误"}
        </Muted>
        <Pressable onPress={onRetry} className="active:opacity-60" accessibilityRole="button">
          <Muted type="body-sm" className="text-link">
            重试
          </Muted>
        </Pressable>
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View className="py-8">
        <Muted type="body-sm" className="text-center">
          {emptyText}
        </Muted>
      </View>
    );
  }
  return <VnCoverCarousel items={items} onPressItem={onPressItem} />;
}
