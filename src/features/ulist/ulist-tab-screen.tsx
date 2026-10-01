/**
 * 清单 Tab：浏览 / 标签筛选 + 下拉刷新。
 *
 * 数据**直读 VNDB**（不落本地库）：标签筛选下推给 `/ulist`（排序固定
 * 加入时间新 → 旧 —— 排序 UI 已按 Master 要求移除），下拉刷新 = 重新拉取最新。
 * 没有「同步」按钮 —— 每次打开/刷新都是最新。
 *
 * 视图有网格（默认，纯封面墙）与列表（带打分 / 标签的行）两种，
 * 右上角按钮直接切换（按钮文案 / 图标表示切过去的目标视图），
 * 选择存 `preferences.vnViewMode` 跨启动记住。
 */

import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { ViewModeButton } from "@/components/view-mode-button";
import { usePreferences } from "@/hooks/use-preferences";
import { useSession } from "@/hooks/use-session";
import { setPreference } from "@/lib/storage/preferences";

import { UlistItems } from "./components/ulist-items";
import { UlistLabelFilter } from "./components/ulist-label-filter";
import { useUlistInfinite, useUlistLabels } from "./hooks";

export function UlistTabScreen(): JSX.Element {
  const session = useSession();
  if (session.status === "loading") return <LoadingState label="加载账号…" />;
  if (session.status !== "authenticated") return <GuestState />;
  return <UlistContent />;
}

function GuestState(): JSX.Element {
  const router = useRouter();
  return (
    <EmptyState
      title="登录后启用清单"
      description="清单数据直接来自 vndb.org。先在「我的 → 账号」粘贴 VNDB Token。"
      action={
        <Button size="sm" onPress={() => router.push("/settings/account")}>
          <Button.Label>去登录</Button.Label>
        </Button>
      }
    />
  );
}

function UlistContent(): JSX.Element {
  const router = useRouter();
  const viewMode = usePreferences().vnViewMode;
  const [labelFilter, setLabelFilter] = useState<number | null>(null);
  const list = useUlistInfinite({ labelId: labelFilter });
  const labels = useUlistLabels();

  const items = useMemo(() => list.data?.pages.flatMap((page) => page.results) ?? [], [list.data]);

  const refreshing = list.isRefetching && !list.isFetchingNextPage;
  const refresh = (): void => {
    void list.refetch();
  };

  if (list.isLoading) return <LoadingState label="从 VNDB 拉取清单…" />;
  if (list.isError) return <ErrorState error={list.error} onRetry={refresh} />;

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 pt-1">
        <ViewModeButton
          value={viewMode}
          onChange={(mode) => void setPreference("vnViewMode", mode)}
        />
      </View>

      <UlistLabelFilter
        labels={labels.data ?? []}
        labelFilter={labelFilter}
        onLabelFilterChange={setLabelFilter}
      />

      {items.length === 0 ? (
        // 空态也要能下拉刷新（列表为空时 FlashList 不渲染，用 ScrollView 承接手势）
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <EmptyState
            title={labelFilter == null ? "清单是空的" : "该标签下没有作品"}
            description="下拉刷新可从 VNDB 重新获取；也可以先去 vndb.org 网站上收藏作品"
          />
        </ScrollView>
      ) : (
        <UlistItems
          mode={viewMode}
          items={items}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          isFetchingNextPage={list.isFetchingNextPage}
          // 点条目 = 进作品详情页；要改打分 / 标签走详情页右上角的「编辑」
          onPressItem={(vnId) => router.push(`/vn/${vnId}`)}
        />
      )}
    </View>
  );
}
