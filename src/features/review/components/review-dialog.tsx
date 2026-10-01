/**
 * 用户评价对话框（首页「最新评价」列表点条目弹出的那一层）。
 *
 * 数据来自抓取 VNDB 网站的单条评价页（见 `../scrape`），正文复用讨论模块的
 * `PostContent` —— 同一套 VNDB 富文本 HTML。
 *
 * **只显示四样**（Master 要求）：作品名、评论用户、评论日期、正文。
 * 评分 / 有用数 / 平台 / 语言 / 通关状态 / 评价版本一律不显示 ——
 * 评分和作者在列表那一行已经给过，作品本身的信息在作品详情页里更全。
 * （`../scrape` 仍然解析这些字段，只是没展示；哪天要显示回来直接加即可。）
 *
 * 作品名与用户名都是站内链接（Master 要求），点之前先关掉对话框 ——
 * 否则会带着一层遮罩跳详情页，返回时遮罩还在。
 *
 * ⚠️ 这一层取代了原来的站内评价页 `/review/{id}`：评价正文虽长但结构简单，
 * 一个可滚动的对话框就够，从列表点开也不用丢掉列表位置。
 */

import { useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Muted } from "@/components/typo";
import { PostContent } from "@/features/discussion/components/post-content";

import { useReview } from "../hooks";

export interface ReviewDialogProps {
  /** 要看的评价 id（`w18526`）；null = 关着 */
  reviewId: string | null;
  onClose: () => void;
}

export function ReviewDialog({ reviewId, onClose }: ReviewDialogProps): JSX.Element {
  const router = useRouter();
  const query = useReview(reviewId ?? "");
  const review = query.data;

  // 先关掉再导航：顺序反了会在详情页上闪一层遮罩
  const goVn = (vnId: string): void => {
    onClose();
    router.push(`/vn/${vnId}`);
  };
  const goUser = (userId: string): void => {
    onClose();
    router.push(`/user/${userId}`);
  };

  return (
    <AppDialog
      isOpen={reviewId !== null}
      onClose={onClose}
      title="用户评价"
      accessibilityLabel="用户评价正文"
    >
      {query.isLoading ? (
        <View className="items-center gap-3 py-8">
          <Spinner size="md" />
          <Muted type="body-sm">抓取评价…</Muted>
        </View>
      ) : null}

      {query.isError ? (
        <View className="gap-3 py-6">
          <Muted type="body-sm" className="text-center">
            读取失败：
            {query.error instanceof Error ? query.error.message : "未知错误"}
          </Muted>
          <Pressable
            onPress={() => void query.refetch()}
            className="self-center active:opacity-60"
            accessibilityRole="button"
          >
            <Muted type="body-sm" className="text-link">
              重试
            </Muted>
          </Pressable>
        </View>
      ) : null}

      {!query.isLoading && !query.isError && !review ? (
        <Muted type="body-sm" className="py-6 text-center">
          没有读到这条评价（VNDB 可能改版导致解析失败）
        </Muted>
      ) : null}

      {review ? (
        <View className="gap-2.5">
          {/* 作品名 —— 站内链接（详情页能拿到 VN id 时） */}
          {review.vnId ? (
            <Pressable
              onPress={() => goVn(review.vnId as string)}
              className="self-start active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel={`打开作品详情：${review.title}`}
            >
              <Muted type="h6" className="text-link">
                {review.title}
              </Muted>
            </Pressable>
          ) : (
            <Muted type="h6">{review.title}</Muted>
          )}

          {/* 评论用户 + 评论日期：独立元素 + 间距排版（Master 不喜欢 `内容 · 内容` 拼接） */}
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {review.author ? (
              <Pressable
                onPress={review.authorId ? () => goUser(review.authorId as string) : undefined}
                className={review.authorId ? "active:opacity-60" : ""}
                accessibilityRole={review.authorId ? "button" : "text"}
                accessibilityLabel={review.authorId ? `打开用户页：${review.author}` : undefined}
              >
                <Muted type="body-sm" className={review.authorId ? "text-link" : ""}>
                  {review.author}
                </Muted>
              </Pressable>
            ) : null}
            {review.date ? (
              <Muted type="body-xs" className="opacity-70">
                {review.date}
              </Muted>
            ) : null}
          </View>

          <View className="h-px bg-separator" />

          {/* 评论内容：PostContent 自己出块级 View，不能塞进 <Text> */}
          <PostContent nodes={review.content} />
        </View>
      ) : null}
    </AppDialog>
  );
}
