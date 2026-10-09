/**
 * 浏览历史页面（入口在「我的」）。
 *
 * - 顶部 `SegmentedControl` 切**分类**（作品 / 人员 / 用户 / 厂商）
 * - **时间范围**从 Header 的日历图标按钮进入面板选择（全部 / 今天 / 近 7 天 / 近 30 天）
 * - 作品档支持**网格 / 列表**切换（复用 `ViewModeButton` + `VnCoverGrid`）
 * - Header 右侧常显**清空**图标按钮，弹窗内可**勾选要删除的分类**（默认全选），二次确认走项目自己的对话框（非系统 Alert）
 *
 * 数据层见 `hooks.ts`（React Query + 本地 SQLite）。
 */

import { useRouter } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { SegmentedControl } from "@/components/segmented-control";
import { ViewModeButton } from "@/components/view-mode-button";
import { usePreferences } from "@/hooks/use-preferences";
import type { HistoryEntry } from "@/lib/db/dao/history";
import { setPreference } from "@/lib/storage/preferences";

import { ClearHistoryDialog } from "./components/clear-dialog";
import { HistoryList } from "./components/history-list";
import { TimeRangePanel } from "./components/time-range-panel";
import {
  isDateFilterEmpty,
  EMPTY_DATE_FILTER,
  HISTORY_TAB_OPTIONS,
  type HistoryDateFilter,
  type HistoryTab,
} from "./history-constants";
import { useClearHistory, useHistoryInfinite, useRemoveHistoryEntry } from "./hooks";

export default function HistoryScreen(): JSX.Element {
  const router = useRouter();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const danger = useThemeColor("danger");
  const viewMode = usePreferences().vnViewMode;
  const [tab, setTab] = useState<HistoryTab>("vn");
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>(EMPTY_DATE_FILTER);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  // 清空弹窗里勾选的分类，默认全选
  const [clearTabs, setClearTabs] = useState<HistoryTab[]>([]);

  const query = useHistoryInfinite(tab, dateFilter);
  const clearHistory = useClearHistory();
  const removeEntry = useRemoveHistoryEntry();

  const entries = query.data?.pages.flat() ?? [];
  // 网格视图只对作品档有意义
  const grid = tab === "vn" && viewMode === "grid";
  // 有日期筛选时给入口上强调色（与浏览页「已自定义」的用法一致）
  const customizedRange = !isDateFilterEmpty(dateFilter);

  const openClear = (): void => {
    setClearTabs(HISTORY_TAB_OPTIONS.map((option) => option.value));
    setClearOpen(true);
  };

  const confirmClear = (): void => {
    if (clearTabs.length === 0) return;
    clearHistory.mutate(clearTabs, { onSuccess: () => setClearOpen(false) });
  };

  const remove = (entry: HistoryEntry): void => {
    removeEntry.mutate({ type: entry.type, entryId: entry.entryId });
  };

  return (
    <View className="flex-1">
      <BackBar
        title="浏览历史"
        onPress={() => router.back()}
        trailing={
          <View className="flex-row items-center gap-1">
            {/* 时间范围：图标按钮打开面板 */}
            <Pressable
              onPress={() => setRangeOpen(true)}
              className="rounded-full p-1.5 active:opacity-70"
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={customizedRange ? "时间范围，已筛选" : "时间范围"}
            >
              <Icon name="calendar" size={18} color={customizedRange ? accent : muted} />
            </Pressable>

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
              accessibilityLabel="清空浏览历史"
            >
              <Icon name="trashBin" size={18} color={danger} />
            </Button>
          </View>
        }
      />

      <View className="px-4 pb-2">
        <SegmentedControl options={HISTORY_TAB_OPTIONS} value={tab} onChange={setTab} />
      </View>

      {query.isLoading ? (
        <LoadingState label="加载历史记录…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState title="暂无浏览历史" description="浏览过的作品、人员、用户与厂商会记录在这里" />
      ) : (
        <HistoryList
          entries={entries}
          grid={grid}
          isFetchingNextPage={query.isFetchingNextPage}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onRemove={remove}
        />
      )}

      <ClearHistoryDialog
        isOpen={clearOpen}
        onClose={() => setClearOpen(false)}
        selected={clearTabs}
        onChange={setClearTabs}
        onConfirm={confirmClear}
      />

      {/* 全屏覆盖层（无 Portal），关闭时整棵子树消失 */}
      {rangeOpen ? (
        <TimeRangePanel
          value={dateFilter}
          onChange={setDateFilter}
          onClose={() => setRangeOpen(false)}
        />
      ) : null}
    </View>
  );
}
