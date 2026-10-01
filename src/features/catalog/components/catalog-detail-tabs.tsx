/**
 * 制作者 / staff 详情共用的页签外壳（概览 / 作品 / 外链）。
 *
 * 这两个页面结构完全一样 —— 头部由各自的 `DetailShell` 负责，下面都是
 * 「简介 + 作品列表 + 外链」三块，只有文案不同。所以整段抽到这里：
 * 各写一份的话，改一处样式要改两处，迟早对不上（`components/ext-link-cards`
 * 就是同一个道理抽出来的）。
 *
 * ## 为什么用 `SegmentedControl` 而不是 HeroUI `Tabs`
 *
 * 只有三档、档位名都只有两个字，分段控件的选中态与应用其它地方
 * （外观 / 内容设置 / 搜索范围切换）一致，也省掉 `Tabs.Indicator` 那一套
 * （HeroUI 不会自动注入，漏了就没有选中底色 —— 踩过）。
 */

import type { JSX, ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { ExtLinkCards, type ExtLink } from "@/components/ext-link-cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { SegmentedControl } from "@/components/segmented-control";
import { ViewModeButton } from "@/components/view-mode-button";
import { VnCollection } from "@/features/vn/components/vn-collection";
import type { VnSummary } from "@/lib/api/types";
import type { VnViewMode } from "@/lib/storage/preferences";

/** 三档页签；顺序即分段控件从左到右 */
export type CatalogTab = "overview" | "works" | "extlinks";

const TAB_OPTIONS: { value: CatalogTab; label: string }[] = [
  { value: "overview", label: "概览" },
  { value: "works", label: "作品" },
  { value: "extlinks", label: "外链" },
];

/** 作品列表那一档要用的查询状态（由调用方的 `useQuery` 提供） */
export interface CatalogWorksQuery {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  items: readonly VnSummary[];
}

export interface CatalogDetailTabsProps {
  tab: CatalogTab;
  onTabChange: (tab: CatalogTab) => void;
  /** 概览档内容（简介等） */
  overview: ReactNode;
  works: CatalogWorksQuery;
  /** 「没有收录作品」的说明（制作者 / 制作人员文案不同） */
  emptyWorksText: string;
  extlinks: readonly ExtLink[] | undefined;
  /** 「没有登记外链」的说明 */
  emptyExtlinksText: string;
  onPressVn: (id: string) => void;
  /** 网格 / 列表偏好（与清单 Tab 共用，跨启动记住） */
  viewMode: VnViewMode;
  onChangeViewMode: (mode: VnViewMode) => void;
}

export function CatalogDetailTabs({
  tab,
  onTabChange,
  overview,
  works,
  emptyWorksText,
  extlinks,
  emptyExtlinksText,
  onPressVn,
  viewMode,
  onChangeViewMode,
}: CatalogDetailTabsProps): JSX.Element {
  return (
    <View className="flex-1">
      <View className="px-4 pt-1">
        <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={onTabChange} />
      </View>

      <View className="flex-1">
        {tab === "overview" ? (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
            {overview}
          </ScrollView>
        ) : null}

        {tab === "works" ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-end px-4 pb-1 pt-2">
              <ViewModeButton value={viewMode} onChange={onChangeViewMode} />
            </View>

            {works.isLoading ? (
              <LoadingState label="拉取作品…" />
            ) : works.isError ? (
              <ErrorState error={works.error} onRetry={works.onRetry} />
            ) : works.items.length === 0 ? (
              <EmptyState title="没有收录作品" description={emptyWorksText} />
            ) : (
              <VnCollection mode={viewMode} items={[...works.items]} onPressItem={onPressVn} />
            )}
          </View>
        ) : null}

        {tab === "extlinks" ? (
          <ExtLinkCards links={extlinks} emptyDescription={emptyExtlinksText} />
        ) : null}
      </View>
    </View>
  );
}
