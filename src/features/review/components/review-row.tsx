/**
 * 评价列表行（首页「最新评价」页签用）。
 *
 * 一行给三样信息：分数（0–10，VNDB 的评价分制，与作品的 0–100 不同）、
 * 作品名、作者 + 通关状态；右侧是相对时间。点行进站内评价页。
 */

import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Separator } from "@/components/separator";
import { Muted, Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey, TranslationParams } from "@/lib/i18n/translate";

import { formatRelativeDays } from "@/utils/format";

import type { VndbReview } from "../scrape";

export interface ReviewRowProps {
  review: VndbReview;
  onPress: (id: string) => void;
}

export function ReviewRow({ review, onPress }: ReviewRowProps): JSX.Element {
  const { t } = useTranslation();
  const when = formatRelativeDays(review.date) ?? review.date;

  return (
    <View>
      <Pressable
        onPress={() => onPress(review.id)}
        className="flex-row items-center gap-3 px-4 py-2.5 active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel={t("review.rowLabel", { title: review.title })}
      >
        <ScoreBadge score={review.score} />

        <View className="flex-1 gap-0.5">
          <Paragraph numberOfLines={2}>{review.title}</Paragraph>
          <View className="flex-row items-center gap-2">
            {review.author ? (
              <Muted type="body-xs" numberOfLines={1}>
                {review.author}
              </Muted>
            ) : null}
            {review.length ? (
              <Muted type="body-xs" className="text-[10px] opacity-70">
                {lengthLabel(review.length, t)}
              </Muted>
            ) : null}
          </View>
        </View>

        {when ? (
          <Muted type="body-xs" className="shrink-0 text-[10px] opacity-70">
            {when}
          </Muted>
        ) : null}
      </Pressable>
      <Separator />
    </View>
  );
}

/** 分数徽标：未打分是「—」，配色跟着分数高低走（与作品评分同一套语义色） */
function ScoreBadge({ score }: { score: number | null }): JSX.Element {
  const tone =
    score == null
      ? "bg-default-soft text-muted"
      : score >= 8
        ? "bg-success-soft text-success-soft-foreground"
        : score >= 5
          ? "bg-warning-soft text-warning-soft-foreground"
          : "bg-danger-soft text-danger-soft-foreground";

  return (
    <View className={`h-9 w-9 items-center justify-center rounded-full ${tone}`}>
      <Muted type="body-sm" className="font-semibold">
        {score == null ? "—" : score}
      </Muted>
    </View>
  );
}

/**
 * 通关状态 / 游玩时长的文案。
 *
 * 官网给的是英文（`Short` / `Medium` / `Long` / `Unfinished`），
 * 这里只做展示层翻译，不改数据。
 */
const LENGTH_LABEL_KEY: Record<string, TranslationKey> = {
  Short: "review.lengthShort",
  Medium: "review.lengthMedium",
  Long: "review.lengthLong",
  Unfinished: "review.lengthUnfinished",
};

function lengthLabel(
  raw: string,
  t: (key: TranslationKey, params?: TranslationParams) => string
): string {
  const key = LENGTH_LABEL_KEY[raw];
  return key ? t(key) : raw;
}
