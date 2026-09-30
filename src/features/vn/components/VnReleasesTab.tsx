/**
 * VN 详情 · 发行版页签。
 *
 * 数据独立请求（列表页的字段集不含发行版）。
 * 有 `listwrite` 权限时，每个发行版带「持有状态」胶囊（Pending / Obtained / On loan）。
 */

import type { JSX } from "react";
import { ScrollView, View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { Muted, Paragraph } from "@/components/Typo";
import { PlatformBadges } from "@/components/ui";
import { ReleaseHoldChips } from "@/features/ulist/components/ReleaseHoldChips";
import { formatReleased } from "@/utils/format";

import { useVnReleases } from "../hooks";

export function VnReleasesTab({ vnId }: { vnId: string }): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useVnReleases(vnId);

  if (isLoading) return <LoadingState label="加载发行版…" className="py-12" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.length === 0) return <EmptyState title="没有登记发行版" />;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      {data.map((release) => (
        <View key={release.id} className="border-b border-border px-4 py-3">
          <Paragraph className="text-sm">{release.title}</Paragraph>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Muted type="body-xs">{formatReleased(release.released)}</Muted>
            <PlatformBadges platforms={release.platforms} max={5} />
            {release.minage != null ? (
              <View className="rounded bg-danger-soft px-1.5 py-0.5">
                <Muted type="body-xs" className="text-danger-soft-foreground">
                  R18
                </Muted>
              </View>
            ) : null}
          </View>

          <ReleaseHoldChips vnId={vnId} release={release} />
        </View>
      ))}
    </ScrollView>
  );
}
