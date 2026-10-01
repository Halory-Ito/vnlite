/**
 * 最新评价竖向列表（首页「最新评价」那一档的内容）。
 *
 * 条数与官网首页那一栏一致（`FEED_COUNT`，见 `features/home/feed-config`）——
 * Master 要求「默认展示的数量和官网首页一致」。
 *
 * 点条目**弹对话框**看正文（`ReviewDialog`），不在站内再开一页 ——
 * 整份列表共用一个对话框（同 `ImageViewer` 的做法：挂在列表这一层）。
 *
 * ⚠️ 这一段**不自己滚动**：外层首页就是一个 ScrollView，10 行直接铺开，
 * 跟着页面一起滚。里面再套一个竖向 ScrollView 会把触摸事件吃掉。
 */

import { Skeleton } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState } from "@/components/screen-state";

import { useLatestReviews } from "../hooks";

import { ReviewDialog } from "./review-dialog";
import { ReviewRow } from "./review-row";

export interface ReviewListProps {
  /** 展示条数（与官网首页一致） */
  limit: number;
}

export function ReviewList({ limit }: ReviewListProps): JSX.Element {
  const query = useLatestReviews(limit);
  // null = 对话框关着；存 id 而不是布尔值，省掉一层「记住是哪一条」
  const [openId, setOpenId] = useState<string | null>(null);
  const reviews = query.data ?? [];
  const failed = query.isError;

  return (
    <View>
      {query.isLoading ? <ReviewListSkeleton rows={4} /> : null}
      {failed ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {!query.isLoading && !failed && reviews.length === 0 ? (
        <EmptyState title="没有评价" description="VNDB 可能改版导致解析失败" className="py-10" />
      ) : null}

      {reviews.length > 0 ? (
        <>
          {reviews.map((review) => (
            <ReviewRow key={review.id} review={review} onPress={setOpenId} />
          ))}
        </>
      ) : null}

      {/* 对话框常驻（不随列表的加载 / 错误状态进出），否则列表一重取就把它卸载了 */}
      <ReviewDialog reviewId={openId} onClose={() => setOpenId(null)} />
    </View>
  );
}

/** 骨架屏：和真实行同高（分数圆 + 两行文字），避免加载完时页面跳一下 */
function ReviewListSkeleton({ rows }: { rows: number }): JSX.Element {
  return (
    <View className="pt-2">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3 px-4 py-2.5">
          <Skeleton variant="pulse" className="h-9 w-9 rounded-full" />
          <View className="flex-1 gap-1.5">
            <Skeleton variant="pulse" className="h-3.5 w-4/5 rounded-md" />
            <Skeleton variant="pulse" className="h-3 w-1/3 rounded-md" />
          </View>
        </View>
      ))}
    </View>
  );
}
