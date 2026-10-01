/**
 * 用户详情页 · 全部打分列表（独立页面 `/user/{id}/votes`）。
 *
 * 入口是资料页「近期打分」右侧的「查看全部」。**不放进资料页**：
 * 这份列表动辄几百条，塞进资料页会把页面拉得极长，还抢走首屏。
 *
 * 三件事：
 *   1. **分页** —— `/ulist` 每页 50 条，滚到底自动加载下一页，到底显示「没有更多了」
 *      （总数拿不到：`/ulist` 的 `count` 未登录一律 400）
 *   2. **可视列开关** —— 头部一个筛选按钮开面板（`VoteColumnsPanel`）
 *   3. **游玩时长** —— 来自抓取 `/u…/lengthvotes`（`/ulist` 没这个字段），
 *      抓不到就显示「—」，不影响其余列
 */

import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { BackBar } from "@/components/BackBar";
import { Icon } from "@/components/Icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { Separator } from "@/components/Separator";
import { Muted } from "@/components/Typo";
import type { UListItem } from "@/lib/api/types";

import { useLengthVoteMap, useUserProfile, useUserVoteItems } from "../hooks";
import { DEFAULT_VOTE_COLUMNS, type VoteColumn } from "../voteColumns";
import { VoteColumnsPanel } from "./VoteColumnsPanel";
import { VoteRow } from "./VoteRow";

export function UserVotesScreen(): JSX.Element {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  // 资料查询在上一屏已经命中缓存，这里只是借用户名当标题，不会重复抓
  const profile = useUserProfile(id);
  const { query, items } = useUserVoteItems(id);
  const lengthVotes = useLengthVoteMap(id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [visible, setVisible] = useState<readonly VoteColumn[]>(DEFAULT_VOTE_COLUMNS);

  const title = profile.data?.username ? `${profile.data.username} 的打分` : "全部打分";

  return (
    <View className="flex-1">
      <BackBar title={title} />

      <View className="flex-row items-center justify-between gap-3 px-4 pb-2">
        {/* 总数拿不到（`/ulist` 的 count 未登录会 400），只能报已加载条数 */}
        <Muted type="body-xs">{query.isLoading ? "拉取中…" : `已加载 ${items.length} 条`}</Muted>
        <ColumnsButton onPress={() => setPanelOpen(true)} />
      </View>

      {query.isLoading ? (
        <LoadingState label="拉取打分记录…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="这个用户没有公开的打分记录" />
      ) : (
        <FlashList<UListItem>
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              <VoteRow item={item} visible={visible} length={lengthVotes.get(item.id)} />
              <Separator />
            </View>
          )}
          onEndReached={query.hasNextPage ? () => void query.fetchNextPage() : undefined}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            <Footer loading={query.isFetchingNextPage} hasMore={query.hasNextPage} />
          }
        />
      )}

      {panelOpen ? (
        <VoteColumnsPanel
          visible={visible}
          onChange={setVisible}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
    </View>
  );
}

/** 头部「控制显示列」按钮 */
function ColumnsButton({ onPress }: { onPress: () => void }): JSX.Element {
  const accent = useThemeColor("accent");

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-full border border-border bg-default-soft px-3 py-1.5 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel="控制显示哪些列"
    >
      <Icon name="sliders" size={14} color={accent} />
      <Muted type="body-xs" className="font-semibold text-accent">
        列
      </Muted>
    </Pressable>
  );
}

/** 列表尾部：加载中的转圈，或「没有更多了」 */
function Footer({ loading, hasMore }: { loading: boolean; hasMore: boolean }): JSX.Element {
  if (loading) {
    return (
      <View className="items-center py-4">
        <Spinner size="sm" />
      </View>
    );
  }
  if (hasMore) return <View className="h-2" />;
  return (
    <Muted type="body-xs" className="py-6 text-center">
      没有更多了
    </Muted>
  );
}
