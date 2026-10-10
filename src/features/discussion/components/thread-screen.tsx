/**
 * 讨论帖正文页（站内渲染，不再跳浏览器）。
 *
 * 数据同样来自抓取 VNDB 网站 `/t950[/2]`（每页 25 楼），正文用
 * `PostContent` 把 HTML 节点树渲染成 RN 节点（粗体 / 斜体 / 下划线 /
 * 链接 / 引用块 / 剧透折叠都在里面处理）。
 *
 * 页脚用「共 N 楼」而不是加载更多按钮：滚到底自动抓下一页。
 */

import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { usePostList } from "../hooks";
import type { VndbPost } from "../scrape";
import { PostContent } from "./post-content";

export function ThreadScreen(): JSX.Element {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { query, posts } = usePostList(id);
  const title = query.data?.pages[0]?.title ?? null;

  return (
    <View className="flex-1">
      <BackBar title={title ?? t("discussion.thread.title")} />

      {query.isLoading ? (
        <LoadingState label={t("discussion.thread.loading")} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState
          title={t("discussion.thread.emptyTitle")}
          description={t("discussion.thread.emptyDescription")}
        />
      ) : (
        <FlashList<VndbPost>
          style={{ flex: 1 }}
          data={posts}
          keyExtractor={(post) => String(post.number)}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          onEndReached={query.hasNextPage ? () => void query.fetchNextPage() : undefined}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner size="sm" />
              </View>
            ) : query.hasNextPage ? null : (
              <Muted type="body-xs" className="py-6 text-center">
                {t("discussion.thread.postCount", { count: posts.length })}
              </Muted>
            )
          }
        />
      )}
    </View>
  );
}

/** 一楼：作者 + 楼层号 / 正文 / 时间（编辑过的补一行「编辑于」） */
function PostCard({ post }: { post: VndbPost }): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View className="mx-4 mt-2 gap-2 rounded-lg bg-default-soft p-3">
      <View className="flex-row items-center justify-between gap-3">
        {/* 作者可点进站内用户页（没有 id 的注销用户就是纯文字） */}
        {post.authorId ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/user/[id]", params: { id: post.authorId as string } })
            }
            className="shrink active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel={t("discussion.openUser", {
              name: post.author ?? post.authorId,
            })}
          >
            <Muted type="body-sm" className="font-medium text-link" numberOfLines={1}>
              {post.author ?? post.authorId}
            </Muted>
          </Pressable>
        ) : (
          <Muted type="body-sm" className="font-medium" numberOfLines={1}>
            {post.author ?? t("discussion.thread.anonymous")}
          </Muted>
        )}
        <Muted type="body-xs" className="opacity-70">
          #{post.number}
        </Muted>
      </View>

      <PostContent nodes={post.content} />

      {/* 时间与「编辑于」分成两个独立元素（Master 不喜欢 `内容 · 内容` 的拼法） */}
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
        {post.date ? (
          <Muted type="body-xs" className="opacity-70">
            {shorten(post.date)}
          </Muted>
        ) : null}
        {post.lastmod ? (
          <Muted type="body-xs" className="opacity-70">
            {t("discussion.thread.edited", { date: shorten(post.lastmod) })}
          </Muted>
        ) : null}
      </View>
    </View>
  );
}

/** `2010-12-23 at 09:31` → `2010-12-23 09:31` */
function shorten(stamp: string): string {
  return stamp.replace(" at ", " ");
}
