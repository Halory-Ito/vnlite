/**
 * VN 详情 · 相似页签。
 *
 * 拿本作的内容标签（`pickSimilarTags`）去 `/vn` 找别的作品，按评分降序。
 * 标签是「本作自带的」，所以没登录、没收藏也能用。
 *
 * 只给封面网格，不解释「依据哪些标签」—— 点进来的人要看的是作品。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { useTranslation } from "@/hooks/use-translation";
import type { VnDetail } from "@/lib/api/types";

import { useSimilarVns } from "@/features/recommend/hooks";
import { VnCoverGrid } from "@/features/vn/components/vn-cover-grid";

export interface VnSimilarTabProps {
  vn: VnDetail;
}

export function VnSimilarTab({ vn }: VnSimilarTabProps): JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const query = useSimilarVns(vn);

  // 标签太少（新作 / 冷门作）时直接说清楚，不用发请求
  if (query.isPending && !query.isFetching) {
    return (
      <EmptyState
        title={t("vn.similarEmptyTitle")}
        description={t("vn.similarNoTags")}
        className="py-10"
      />
    );
  }

  if (query.isLoading) return <LoadingState label={t("vn.similarLoading")} />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const vns = query.data ?? [];
  if (vns.length === 0) {
    return (
      <EmptyState
        title={t("vn.similarEmptyTitle")}
        description={t("vn.similarEmptyDescription")}
        className="py-10"
      />
    );
  }

  return (
    <View className="flex-1">
      <VnCoverGrid
        entries={vns.map((item) => ({ id: item.id, title: item.title, image: item.image }))}
        onPressItem={(id) => router.push(`/vn/${id}`)}
      />
    </View>
  );
}
