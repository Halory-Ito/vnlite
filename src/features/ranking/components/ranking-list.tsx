/**
 * 排行榜的列表（年度榜 / 题材榜共用）。
 *
 * 一行：名次 + 封面 + 标题 + 评分 / 票数。前三名用主题色，其余走 muted。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted, Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import { formatRating } from "@/utils/format";

export interface RankingListProps {
  items: readonly VnSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

export function RankingList({
  items,
  isLoading,
  isError,
  error,
  onRetry,
}: RankingListProps): JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");

  if (isLoading) return <LoadingState label={t("ranking.loading")} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title={t("ranking.emptyTitle")}
        description={t("ranking.emptyDescription")}
        className="py-12"
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      {items.map((vn, index) => (
        <Pressable
          key={vn.id}
          onPress={() => router.push(`/vn/${vn.id}`)}
          className="flex-row items-center gap-3 px-4 py-2 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={t("ranking.rowLabel", { rank: index + 1, title: vn.title })}
        >
          <Paragraph
            className="w-6 text-right font-semibold"
            style={{ color: index < 3 ? accent : muted }}
          >
            {index + 1}
          </Paragraph>

          <CoverImage
            url={vn.image?.thumbnail}
            width={44}
            height={[44, 62]}
            sexual={vn.image?.sexual}
            violence={vn.image?.violence}
            accessibilityLabel={vn.title}
          />

          <View className="flex-1 justify-center gap-0.5">
            <Paragraph numberOfLines={2}>{vn.title}</Paragraph>
            <Muted type="body-xs">
              {t("ranking.scoreMeta", {
                rating: formatRating(vn.rating),
                votes: vn.votecount ?? 0,
              })}
            </Muted>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
