/**
 * VN 详情 · 评价页签。
 *
 * 数据来自 VNDB 网站的作品评价页（`/v17/reviews`，见 `../lib/client`）——
 * Kana 没有评价端点，只能抓网页。
 *
 * 每张卡片给：分数、作者、日期、篇幅、正文摘要、有用数 / 评论数。
 * 点卡片弹 `ReviewDialog` 看全文（与首页「最新评价」同一个对话框）。
 */

import { Skeleton } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { EmptyState, ErrorState } from "@/components/screen-state";
import { Muted, Paragraph } from "@/components/typo";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey, TranslationParams } from "@/lib/i18n/translate";
import { formatRelativeDays } from "@/utils/format";

import type { VnReviewEntry } from "@/features/review/lib/scrape";
import { useVnReviews } from "@/features/review/hooks";

import { ReviewDialog } from "./review-dialog";

export interface VnReviewsTabProps {
  vnId: string;
}

export function VnReviewsTab({ vnId }: VnReviewsTabProps): JSX.Element {
  const { t } = useTranslation();
  const query = useVnReviews(vnId);
  const [openId, setOpenId] = useState<string | null>(null);
  const reviews = query.data ?? [];

  if (query.isLoading) return <ReviewsSkeleton />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (reviews.length === 0) {
    return (
      <EmptyState
        title={t("review.vnEmptyTitle")}
        description={t("review.vnEmptyDescription")}
        className="py-10"
      />
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} onPress={() => setOpenId(review.id)} />
        ))}
      </ScrollView>
      <ReviewDialog reviewId={openId} onClose={() => setOpenId(null)} />
    </View>
  );
}

function ReviewCard({
  review,
  onPress,
}: {
  review: VnReviewEntry;
  onPress: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const surface = useTranslucentSurface();
  const when = formatRelativeDays(review.date) ?? review.date;

  const meta = [
    review.score == null ? null : `${review.score}/10`,
    review.length ? lengthLabel(review.length, t) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const stats = [
    review.points ? t("review.points", { count: review.points }) : null,
    review.comments > 0 ? t("review.comments", { count: review.comments }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      style={surface}
      className="mx-4 my-1.5 gap-2 rounded-xl p-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={t("review.rowLabel", { title: review.author ?? t("common.anonymous") })}
    >
      <View className="flex-row items-center gap-2">
        <Paragraph numberOfLines={1} className="flex-1">
          {review.author ?? t("common.anonymous")}
        </Paragraph>
        {meta ? (
          <Muted type="body-xs" className="text-[10px] opacity-70">
            {meta}
          </Muted>
        ) : null}
        {when ? (
          <Muted type="body-xs" className="text-[10px] opacity-70">
            {when}
          </Muted>
        ) : null}
      </View>

      {review.excerpt ? (
        <Muted type="body-xs" numberOfLines={4}>
          {review.excerpt}
        </Muted>
      ) : null}

      {stats ? (
        <Muted type="body-xs" className="text-[10px] opacity-60">
          {stats}
        </Muted>
      ) : null}
    </Pressable>
  );
}

/** 骨架屏：和真实卡片同高（头一行 + 四行正文），避免加载完页面跳一下 */
function ReviewsSkeleton(): JSX.Element {
  return (
    <View className="pt-2">
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} className="mx-4 my-1.5 gap-2 rounded-xl bg-surface p-3">
          <Skeleton variant="pulse" className="h-3.5 w-1/2 rounded-md" />
          <Skeleton variant="pulse" className="h-3 w-full rounded-md" />
          <Skeleton variant="pulse" className="h-3 w-4/5 rounded-md" />
        </View>
      ))}
    </View>
  );
}

/** 篇幅文案（官网给的是英文枚举） */
const LENGTH_LABEL_KEY: Record<string, TranslationKey> = {
  Short: "review.lengthShort",
  Medium: "review.lengthMedium",
  Long: "review.lengthLong",
};

function lengthLabel(
  raw: string,
  t: (key: TranslationKey, params?: TranslationParams) => string
): string {
  const key = LENGTH_LABEL_KEY[raw];
  return key ? t(key) : raw;
}
