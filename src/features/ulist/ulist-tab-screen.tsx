/**
 * 清单 Tab：浏览 / 标签筛选 + 下拉刷新。
 *
 * 数据**直读 VNDB**（不落本地库）：下拉刷新 = 重新拉取最新。
 * 没有「同步」按钮 —— 每次打开/刷新都是最新。
 *
 * **标签筛选在本地做**（Master 要求）：清单整份分页拉回来之后，切标签只是换个
 * 过滤条件（`filterByLabel`），所以切换零请求、也没有 loading 动画。
 * 筛选只能作用于「已加载」的条目，所以底部会说明筛出了多少、并给一个「加载更多」
 * 补齐未过滤清单的下一页（原因见 `hooks.ts` 顶部）。
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
import { useTranslation } from "@/hooks/use-translation";
import { setPreference } from "@/lib/storage/preferences";

import { UlistItems } from "./components/ulist-items";
import { UlistLabelFilter } from "./components/ulist-label-filter";
import { useUlistInfinite, useUlistLabels } from "./hooks";
import { filterByLabel } from "./list-filter";

export function UlistTabScreen(): JSX.Element {
  const { t } = useTranslation();
  const session = useSession();
  if (session.status === "loading") return <LoadingState label={t("ulist.loadingAccount")} />;
  if (session.status !== "authenticated") return <GuestState />;
  return <UlistContent />;
}

function GuestState(): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t("ulist.guestTitle")}
      description=""
      action={
        <Button size="sm" onPress={() => router.push("/settings/account")}>
          <Button.Label>{t("ulist.goLogin")}</Button.Label>
        </Button>
      }
    />
  );
}

function UlistContent(): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const viewMode = usePreferences().vnViewMode;
  const [labelFilter, setLabelFilter] = useState<number | null>(null);
  // ⚠️ 不传 labelId：标签筛选是纯客户端行为，切标签不会换 queryKey
  const list = useUlistInfinite();
  const labels = useUlistLabels();

  const loaded = useMemo(() => list.data?.pages.flatMap((page) => page.results) ?? [], [list.data]);
  const items = useMemo(() => filterByLabel(loaded, labelFilter), [loaded, labelFilter]);

  const refreshing = list.isRefetching && !list.isFetchingNextPage;
  const refresh = (): void => {
    void list.refetch();
  };
  const loadMore = (): void => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  };

  if (list.isLoading) return <LoadingState label={t("ulist.loadingList")} />;
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
            title={labelFilter == null ? t("ulist.emptyTitle") : t("ulist.emptyLabelTitle")}
            description={
              labelFilter == null ? t("ulist.emptyDescription") : t("ulist.emptyLabelDescription")
            }
            action={
              // 还没加载完时，「没有」只是「暂时没加载到」——给个继续加载的出口
              labelFilter != null && list.hasNextPage ? (
                <LoadMoreButton loading={list.isFetchingNextPage} onPress={loadMore} />
              ) : null
            }
          />
        </ScrollView>
      ) : (
        <UlistItems
          mode={viewMode}
          items={items}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={loadMore}
          isFetchingNextPage={list.isFetchingNextPage}
          // 点条目 = 进作品详情页；要改打分 / 标签走详情页右上角的「编辑」
          onPressItem={(vnId) => router.push(`/vn/${vnId}`)}
          footer={
            // 只留「加载更多」这个出口，不显示「N 条里筛出 M 条」这类读数
            // （Master 要求；各标签的真实条数胶囊上已经写着）
            <LoadMoreFooter
              show={labelFilter != null && !!list.hasNextPage}
              loading={list.isFetchingNextPage}
              onPress={loadMore}
            />
          }
        />
      )}
    </View>
  );
}

/** 筛选态的列表脚注：只给一个补齐未加载部分的入口，没有别的文案 */ function LoadMoreFooter({
  show,
  loading,
  onPress,
}: {
  show: boolean;
  loading: boolean;
  onPress: () => void;
}): JSX.Element | null {
  if (!show) return null;
  return (
    <View className="items-center py-4">
      <LoadMoreButton loading={loading} onPress={onPress} />
    </View>
  );
}

function LoadMoreButton({
  loading,
  onPress,
}: {
  loading: boolean;
  onPress: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <Button size="sm" variant="ghost" onPress={onPress} isDisabled={loading}>
      <Button.Label>{loading ? t("common.loading") : t("ulist.loadMore")}</Button.Label>
    </Button>
  );
}
