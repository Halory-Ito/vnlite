/**
 * 浏览页：可排序 / 可筛选的 VN 大列表。
 *
 * 与首页的区别：这里是「一次看很多」的入口，支持**排序面板**（字段 + 方向）
 * 与筛选面板。排序偏好存 `preferences.browseSort`（默认人气降序）。
 *
 * 排序 / 筛选 / 卡片显示三个面板都是全屏覆盖层（`panel.tsx`），**不是** BottomSheet ——
 * 原因见该文件顶部，简单说是为了避开全局 Portal 层的触摸穿透。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Muted } from "@/components/typo";
import { ActiveFilterStrip, describeFilters } from "@/features/browse/components/filter-summary";
import { DisplayPanel } from "@/features/browse/components/display-panel";
import { FilterPanel } from "@/features/browse/components/filter-panel";
import { SortPanel } from "@/features/browse/components/sort-panel";
import { DEFAULT_BROWSE_SORT, findSortOption } from "@/features/sort/sort-options";
import { flattenPages, useVnList } from "@/features/vn/hooks";
import { VnInfiniteList } from "@/features/vn/components/vn-infinite-list";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { VnFilterState } from "@/lib/api/filters";
import type { VnSummary } from "@/lib/api/types";
import { CARD_FIELD, setPreference } from "@/lib/storage/preferences";

export default function BrowseTab(): JSX.Element {
  const router = useRouter();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const preferences = usePreferences();
  const { t } = useTranslation();

  const [filters, setFilters] = useState<VnFilterState>({});
  const [sortOpen, setSortOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  const sortPref = preferences.browseSort;
  const sort = useMemo(() => findSortOption(sortPref.field), [sortPref.field]);

  const query = useVnList({
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    sort: sort.value,
    reverse: sortPref.reverse,
  });

  const items = flattenPages<VnSummary>(query.data?.pages);
  // 计数直接由「已生效条件」推导，面板和这里不可能对不上
  const activeFilterCount = describeFilters(filters).length;
  // 卡片字段被改过（不是全开）时给「显示」按钮上强调色，和筛选按钮的用法一致
  const customizedDisplay = preferences.cardFields.length !== CARD_FIELD.length;
  // 排序不是默认（人气降序）时给「排序」按钮上强调色，同上
  const customizedSort =
    sortPref.field !== DEFAULT_BROWSE_SORT.value ||
    sortPref.reverse !== DEFAULT_BROWSE_SORT.reverse;

  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pt-1 pb-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            {/* 排序：字段 + 方向都在面板里选，默认人气降序 */}
            <Pressable
              onPress={() => setSortOpen(true)}
              className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={
                customizedSort
                  ? t("browse.toolbar.sortLabelCustomized")
                  : t("browse.toolbar.sortLabel")
              }
              hitSlop={6}
            >
              <Icon
                name="barsAscendingAlignLeft"
                size={18}
                color={customizedSort ? accent : muted}
              />
              <Muted type="body-sm" className={customizedSort ? "text-accent" : "text-muted"}>
                {t("browse.toolbar.sort")}
              </Muted>
            </Pressable>

            {/* 卡片显示：和筛选是两码事，所以单独一个入口，放在筛选左边 */}
            <Pressable
              onPress={() => setDisplayOpen(true)}
              className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={
                customizedDisplay
                  ? t("browse.toolbar.displayLabelCustomized")
                  : t("browse.toolbar.displayLabel")
              }
              hitSlop={6}
            >
              <Icon name="eye" size={18} color={customizedDisplay ? accent : muted} />
              <Muted type="body-sm" className={customizedDisplay ? "text-accent" : "text-muted"}>
                {t("browse.toolbar.display")}
              </Muted>
            </Pressable>

            <Pressable
              onPress={() => setPanelOpen(true)}
              className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={
                activeFilterCount > 0
                  ? t("browse.toolbar.filterLabelWithCount", { count: activeFilterCount })
                  : t("browse.toolbar.filterLabel")
              }
              hitSlop={6}
            >
              {/* 图标只能吃具体色值（不吃 className），所以走主题 accent / muted */}
              <Icon name="sliders" size={18} color={activeFilterCount > 0 ? accent : muted} />
              <Muted
                type="body-sm"
                className={activeFilterCount > 0 ? "text-accent" : "text-muted"}
              >
                {activeFilterCount > 0
                  ? t("browse.toolbar.filterWithCount", { count: activeFilterCount })
                  : t("browse.toolbar.filter")}
              </Muted>
            </Pressable>
          </View>
        </View>

        {/* 列表外的条件速览：不打开面板也能看到、点标签直接撤销 */}
        <ActiveFilterStrip filters={filters} onChange={setFilters} />
      </View>

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
        emptyTitle={
          activeFilterCount > 0
            ? t("browse.toolbar.emptyFilteredTitle")
            : t("browse.toolbar.emptyTitle")
        }
        emptyDescription={
          activeFilterCount > 0 ? t("browse.toolbar.emptyFilteredDescription") : undefined
        }
      />

      {/*
       * 全屏覆盖层，直接盖在同层最上面（zIndex: 10）。
       * 没有 Portal、没有 BottomSheet —— 关闭时整棵子树消失，
       * 不存在「关掉了还留一层吃触摸」的问题。
       */}
      {sortOpen ? (
        <SortPanel
          value={sortPref}
          onChange={(next) => void setPreference("browseSort", next)}
          onClose={() => setSortOpen(false)}
        />
      ) : null}

      {panelOpen ? (
        <FilterPanel
          onClose={() => setPanelOpen(false)}
          value={filters}
          onChange={setFilters}
          resultCount={items.length > 0 ? items.length : undefined}
        />
      ) : null}

      {displayOpen ? <DisplayPanel onClose={() => setDisplayOpen(false)} /> : null}
    </View>
  );
}
