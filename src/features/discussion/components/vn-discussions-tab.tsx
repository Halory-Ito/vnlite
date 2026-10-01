/**
 * VN 详情 · 讨论页签。
 *
 * 数据来自**抓取 VNDB 网站** `/t/{vndbid}` 的 HTML（Kana API 没有讨论端点，
 * 见 `scrape.ts` 顶部说明）。列表只渲染「帖子级」信息：标题 / 回复数 /
 * 发起人 / 最后回复；点一条进**站内帖子页**（`/thread/{id}`，正文由
 * `ThreadScreen` 抓取渲染），不再跳浏览器。
 *
 * 列表每页 50 条，滚到底自动抓下一页。
 * 元信息用独立元素 + 间距排版，不用 `内容 · 内容` 的拼接（Master 不喜欢）。
 */

import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Separator } from "@/components/separator";
import { Muted, Paragraph } from "@/components/typo";

import { useThreadList } from "../hooks";
import type { VndbThread } from "../scrape";

export function VnDiscussionsTab({ vnId }: { vnId: string }): JSX.Element {
  const { query, threads } = useThreadList(vnId);

  if (query.isLoading) return <LoadingState label="抓取讨论列表…" className="py-12" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (threads.length === 0) {
    return <EmptyState title="该作品暂无讨论" description="VNDB 讨论板上还没有相关话题" />;
  }

  return (
    <View className="flex-1">
      <Muted type="body-xs" className="px-4 pt-3 pb-1">
        共 {threads.length} 条讨论
      </Muted>
      <FlashList<VndbThread>
        style={{ flex: 1 }}
        data={threads}
        keyExtractor={(thread) => thread.id}
        renderItem={({ item }) => (
          <View>
            <ThreadRow thread={item} />
            <Separator />
          </View>
        )}
        // 翻到底再抓下一页（官网每页 50 条，底部有 rel="next"）
        onEndReached={query.hasNextPage ? () => void query.fetchNextPage() : undefined}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="items-center py-4">
              <Spinner size="sm" />
            </View>
          ) : (
            <View className="h-6" />
          )
        }
      />
    </View>
  );
}

/** 一条帖子：标题 + 元信息行；整行进去站内帖子页 */
function ThreadRow({ thread }: { thread: VndbThread }): JSX.Element {
  const router = useRouter();
  // 图标只能吃具体色值（不吃 className），所以走主题 muted
  const muted = useThemeColor("muted");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/thread/[id]", params: { id: thread.id } })}
      className="flex-row items-center gap-3 px-4 py-3 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={`打开讨论帖：${thread.title}`}
    >
      <View className="flex-1 gap-1">
        <Paragraph className="line-clamp-2">{thread.title}</Paragraph>

        {/* 元信息：每个字段一个独立元素（不用 `内容 · 内容` 拼接）；昵称可点进用户页 */}
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
          <View className="flex-row items-center gap-1">
            <Muted type="body-xs" className="opacity-70">
              发起自
            </Muted>
            <UserName id={thread.starterId} name={thread.starter} />
          </View>
          <View className="flex-row items-center gap-1">
            <Muted type="body-xs" className="opacity-70">
              最后回复
            </Muted>
            <UserName id={thread.lastPosterId} name={thread.lastPoster} />
          </View>
          {thread.lastPost ? (
            <Muted type="body-xs" className="opacity-70">
              {thread.lastPost}
            </Muted>
          ) : null}
        </View>
      </View>

      <View className="items-center">
        <Muted type="body-sm" className="font-semibold text-accent">
          {thread.replies}
        </Muted>
        <Muted type="body-xs" className="text-[10px] opacity-70">
          回复
        </Muted>
      </View>

      <Icon name="chevronRight" size={16} color={muted} />
    </Pressable>
  );
}

/**
 * 昵称：拿到用户 id 时可点进站内用户页；没有 id（注销用户 / 解析不到）就纯文字。
 * 用 `text-link` 标示可点，跟站内其它链接一个视觉语言。
 */
function UserName({ id, name }: { id: string | null; name: string | null }): JSX.Element | null {
  const router = useRouter();
  if (!name) return null;
  if (!id)
    return (
      <Muted type="body-xs" className="opacity-70">
        {name}
      </Muted>
    );

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/user/[id]", params: { id } })}
      className="active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={`打开用户页：${name}`}
    >
      <Muted type="body-xs" className="text-link">
        {name}
      </Muted>
    </Pressable>
  );
}
