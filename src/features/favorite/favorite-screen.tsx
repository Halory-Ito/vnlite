/**
 * 收藏页面（入口在「我的」）。
 *
 * - 顶部 `SegmentedControl` 切**分类**（作品 / 人员 / 用户 / 厂商）
 * - 作品档支持**网格 / 列表**切换（复用 `ViewModeButton` + `VnCoverGrid`）
 * - Header 右侧常显**清空**图标按钮，弹窗内可**勾选要删除的分类**（默认全选）
 *
 * 数据层见 `hooks.ts`（React Query + 本地 SQLite）。
 */

import { useRouter } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { ClearCategoriesDialog } from "@/components/clear-categories-dialog";
import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { SegmentedControl } from "@/components/segmented-control";
import { ViewModeButton } from "@/components/view-mode-button";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { FavoriteEntry } from "@/lib/db/dao/favorite";
import { setPreference } from "@/lib/storage/preferences";

import { FavoriteList } from "./components/favorite-list";
import { FAVORITE_TAB_OPTIONS, favoriteTabOptions, type FavoriteTab } from "./favorite-constants";
import { useClearFavorites, useFavoritesInfinite, useRemoveFavorite } from "./hooks";

export default function FavoriteScreen(): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const danger = useThemeColor("danger");
  const viewMode = usePreferences().vnViewMode;
  const [tab, setTab] = useState<FavoriteTab>("vn");
  const [clearOpen, setClearOpen] = useState(false);
  // 清空弹窗里勾选的分类，默认全选
  const [clearTabs, setClearTabs] = useState<FavoriteTab[]>([]);
  const tabOptions = favoriteTabOptions(t);

  const query = useFavoritesInfinite(tab);
  const clearFavorites = useClearFavorites();
  const removeFavorite = useRemoveFavorite();

  const entries = query.data?.pages.flat() ?? [];
  // 网格视图只对作品档有意义
  const grid = tab === "vn" && viewMode === "grid";

  const openClear = (): void => {
    setClearTabs(FAVORITE_TAB_OPTIONS.map((option) => option.value));
    setClearOpen(true);
  };

  const confirmClear = (): void => {
    if (clearTabs.length === 0) return;
    clearFavorites.mutate(clearTabs, { onSuccess: () => setClearOpen(false) });
  };

  const remove = (entry: FavoriteEntry): void => {
    removeFavorite.mutate({ type: entry.type, entryId: entry.entryId });
  };

  return (
    <View className="flex-1">
      <BackBar
        title={t("favorite.title")}
        onPress={() => router.back()}
        trailing={
          <View className="flex-row items-center gap-1">
            {tab === "vn" ? (
              <ViewModeButton
                value={viewMode}
                onChange={(mode) => void setPreference("vnViewMode", mode)}
              />
            ) : null}

            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={openClear}
              accessibilityLabel={t("favorite.clear")}
            >
              <Icon name="trashBin" size={18} color={danger} />
            </Button>
          </View>
        }
      />

      <View className="px-4 pb-2">
        <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />
      </View>

      {query.isLoading ? (
        <LoadingState label={t("favorite.loading")} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState title={t("favorite.emptyTitle")} description={t("favorite.emptyDescription")} />
      ) : (
        <FavoriteList
          entries={entries}
          grid={grid}
          isFetchingNextPage={query.isFetchingNextPage}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onRemove={remove}
        />
      )}

      <ClearCategoriesDialog
        isOpen={clearOpen}
        onClose={() => setClearOpen(false)}
        title={t("favorite.clear")}
        description={t("favorite.clearDescription")}
        options={tabOptions}
        selected={clearTabs}
        onChange={setClearTabs}
        onConfirm={confirmClear}
      />
    </View>
  );
}
