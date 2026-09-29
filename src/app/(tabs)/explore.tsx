/**
 * 浏览页：可排序 / 可筛选的 VN 大列表。
 *
 * 与首页的区别：这里是「一次看很多」的入口，支持排序切换 + 筛选面板。
 * 首页点「全部」会带 `?sort=` 参数跳过来。
 *
 * 筛选面板是全屏覆盖层（`FilterPanel`），**不是** BottomSheet ——
 * 原因见该文件顶部，简单说是为了避开全局 Portal 层的触摸穿透。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Muted } from "@/components/Typo";
import { ActiveFilterStrip, describeFilters } from "@/features/browse/components/FilterSummary";
import { DisplayPanel } from "@/features/browse/components/DisplayPanel";
import { FilterPanel } from "@/features/browse/components/FilterPanel";
import { BROWSE_SORT_OPTIONS, findSort } from "@/features/sort/sortOptions";
import { flattenPages, useVnList } from "@/features/vn/hooks";
import { VnInfiniteList } from "@/features/vn/components/VnInfiniteList";
import { usePreferences } from "@/hooks/usePreferences";
import type { VnFilterState } from "@/lib/api/filters";
import type { VnSummary } from "@/lib/api/types";
import { CARD_FIELD } from "@/lib/storage/preferences";

type SortKey = (typeof BROWSE_SORT_OPTIONS)[number]["value"];

const VALID_SORTS = new Set<string>(BROWSE_SORT_OPTIONS.map((o) => o.value));

export default function BrowseTab(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ sort?: string }>();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const preferences = usePreferences();

  const [sortValue, setSortValue] = useState<SortKey>(() =>
    params.sort && VALID_SORTS.has(params.sort) ? (params.sort as SortKey) : "released"
  );
  const [filters, setFilters] = useState<VnFilterState>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);

  const sort = useMemo(
    () => findSort(BROWSE_SORT_OPTIONS, sortValue, BROWSE_SORT_OPTIONS[0]!),
    [sortValue]
  );

  const query = useVnList({
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    sort: sort.value,
    reverse: sort.reverse,
  });

  const items = flattenPages<VnSummary>(query.data?.pages);
  // 计数直接由「已生效条件」推导，面板和这里不可能对不上
  const activeFilterCount = describeFilters(filters).length;
  // 卡片字段被改过（不是全开）时给「显示」按钮上强调色，和筛选按钮的用法一致
  const customizedDisplay = preferences.cardFields.length !== CARD_FIELD.length;

  return (
    <View className="flex-1">
      <View className="gap-2 px-4 pt-1 pb-2">
        <View className="flex-row items-center justify-between">
          <Muted type="h5">浏览</Muted>
          <View className="flex-row items-center gap-1">
            {/* 卡片显示：和筛选是两码事，所以单独一个入口，放在筛选左边 */}
            <Pressable
              onPress={() => setDisplayOpen(true)}
              className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={customizedDisplay ? "卡片显示设置，已自定义" : "卡片显示设置"}
              hitSlop={6}
            >
              <Icon name="eye" size={18} color={customizedDisplay ? accent : muted} />
              <Muted type="body-sm" className={customizedDisplay ? "text-accent" : "text-muted"}>
                显示
              </Muted>
            </Pressable>

            <Pressable
              onPress={() => setPanelOpen(true)}
              className="flex-row items-center gap-1 rounded-full px-2 py-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={
                activeFilterCount > 0 ? `筛选，已选 ${activeFilterCount} 项` : "筛选"
              }
              hitSlop={6}
            >
              {/* 图标只能吃具体色值（不吃 className），所以走主题 accent / muted */}
              <Icon name="sliders" size={18} color={activeFilterCount > 0 ? accent : muted} />
              <Muted
                type="body-sm"
                className={activeFilterCount > 0 ? "text-accent" : "text-muted"}
              >
                筛选{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </Muted>
            </Pressable>
          </View>
        </View>

        <SegmentedControl
          options={BROWSE_SORT_OPTIONS.map(({ value, label }) => ({ value, label }))}
          value={sortValue}
          onChange={setSortValue}
        />

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
        emptyTitle={activeFilterCount > 0 ? "没有符合条件的作品" : "列表是空的"}
        emptyDescription={activeFilterCount > 0 ? "试着放宽筛选条件" : undefined}
      />

      {/*
       * 全屏覆盖层，直接盖在同层最上面（zIndex: 10）。
       * 没有 Portal、没有 BottomSheet —— 关闭时整棵子树消失，
       * 不存在「关掉了还留一层吃触摸」的问题。
       */}
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
