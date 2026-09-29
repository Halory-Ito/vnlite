/**
 * 「我的评分排名」。
 *
 * 语义（对标 vndb.org 的 rating rank）：
 *   把「我打过分的所有 VN」按**全球评分**排序，算出每一部的全球名次，
 *   再汇总成「我打分的 N 部作品里，有多少部进了全球前 X%」。
 *
 * 为什么要两跳查询：`/ulist` 只返回我自己的 vote（10–100 的自评分），
 * 全球评分是 VN 的字段，必须再查一次 `/vn`。所以：
 *   1. 分页拉完自己的清单，筛出 vote != null 的条目
 *   2. 批量取这些 VN 的 rating + votecount（一次 100 个，别循环单查）
 *   3. 本地排序 + 算百分位
 *
 * ⚠️ 排名只在我打过分的这批里算，不是全库 66,746 部 —— 全库排名需要
 * 按 rating 分桶请求，得不偿失且吃限流配额。
 */

import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, View } from "react-native";
import { Button, Card, useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { Icon } from "@/components/Icon";
import { Divider } from "@/components/Separator";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { H2, H5, Muted, Paragraph } from "@/components/Typo";
import { StatBlock } from "@/components/ui";
import { useSession } from "@/hooks/useSession";
import { getVns, queryList } from "@/lib/api";
import type { VnSummary } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { formatRating } from "@/utils/format";

/** 一页取多少个 id 去查全球评分 */
const BATCH = 100;

interface RankedVn {
  id: string;
  title: string;
  released?: string;
  rating?: number;
  votecount?: number;
  image?: { url: string };
  /** 我给它的分 */
  myVote: number;
  /** 在我这批里的名次（1 = 最高分） */
  rank: number;
}

export default function RankScreen(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const isLoggedIn = session.status === "authenticated";

  const query = useQuery({
    queryKey: queryKeys.account.ratingRank(),
    enabled: isLoggedIn,
    staleTime: STALE_TIME.ulist,
    queryFn: async () => {
      // 1) 拉完自己的清单
      const myVotes = new Map<string, number>();
      let page = 1;
      for (;;) {
        const res = await queryList({ results: 100, page, sort: "voted", reverse: true });
        for (const item of res.results) {
          if (item.vote != null) myVotes.set(item.id, item.vote);
        }
        if (!res.more || page >= 20) break;
        page += 1;
      }

      const ids = [...myVotes.keys()];
      if (ids.length === 0) return { ranked: [] as RankedVn[], total: 0 };

      // 2) 批量取全球评分
      const details: VnSummary[] = [];
      for (let i = 0; i < ids.length; i += BATCH) {
        const res = await getVns(ids.slice(i, i + BATCH));
        details.push(...(res.results as VnSummary[]));
      }

      // 3) 本地排序 + 名次
      const ranked = details
        .filter((vn) => vn.rating != null)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .map((vn, i) => ({
          id: vn.id,
          title: vn.title,
          released: vn.released,
          rating: vn.rating ?? undefined,
          votecount: vn.votecount,
          image: vn.image,
          myVote: myVotes.get(vn.id) ?? 0,
          rank: i + 1,
        }));

      return { ranked, total: ids.length };
    },
  });

  if (!isLoggedIn) {
    return (
      <View className="flex-1">
        <BackBar onBack={() => router.back()} />
        <EmptyState
          title="需要登录"
          description="「我的评分排名」要读取你自己的清单。请先在「我的」页粘贴 VNDB Token。"
          action={
            <Button size="sm" className="mt-2" onPress={() => router.push("/(tabs)/me")}>
              <Button.Label>去登录</Button.Label>
            </Button>
          }
        />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <BackBar onBack={() => router.back()} title="我的评分排名" />

      {query.isLoading ? (
        <LoadingState label="正在统计你的评分…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <RankContent ranked={query.data?.ranked ?? []} total={query.data?.total ?? 0} />
      )}
    </ScrollView>
  );
}

function RankContent({ ranked, total }: { ranked: RankedVn[]; total: number }): JSX.Element {
  const router = useRouter();

  if (total === 0 || ranked.length === 0) {
    return <EmptyState title="还没有评分记录" description="给作品打分之后这里会显示你的全球排名" />;
  }

  // 百分位：排在前 10% / 25% / 50% 的数量
  const n = ranked.length;
  const top10 = ranked.filter((v) => v.rank <= Math.ceil(n * 0.1)).length;
  const top25 = ranked.filter((v) => v.rank <= Math.ceil(n * 0.25)).length;
  const top50 = ranked.filter((v) => v.rank <= Math.ceil(n * 0.5)).length;
  const avgMy = ranked.reduce((sum, v) => sum + v.myVote, 0) / n;
  const avgGlobal = ranked.reduce((sum, v) => sum + (v.rating ?? 0), 0) / n;

  return (
    <View>
      <View className="flex-row gap-2 px-4 py-4">
        <StatBlock value={String(n)} label="已评分" tone="accent" />
        <StatBlock value={String(top10)} label="全球前 10%" />
        <StatBlock value={String(top25)} label="全球前 25%" />
      </View>
      <View className="flex-row gap-2 px-4 pb-4">
        <StatBlock value={String(top50)} label="全球前 50%" />
        <StatBlock value={formatRating(avgMy)} label="我给的均分" />
        <StatBlock value={formatRating(avgGlobal)} label="全球均分" />
      </View>

      <View className="px-4 pb-4">
        <Muted type="body-xs">
          排名只在你打分的这 {n} 部里计算，不是全库排序。要看全库排行请去「浏览 · 评分排行」。
        </Muted>
      </View>

      <Divider />
      <View className="px-4 py-2">
        <H5>全部 {n} 部</H5>
      </View>

      {ranked.map((vn) => (
        <Pressable
          key={vn.id}
          onPress={() => router.push(`/vn/${vn.id}`)}
          className="active:opacity-60"
        >
          <Card className="mx-4 my-1">
            <Card.Body>
              <View className="flex-row items-center gap-3">
                <View className="w-9 items-center">
                  <Muted type="body-xs" className="text-[10px]">
                    #
                  </Muted>
                  <H2 className="text-accent">{vn.rank}</H2>
                </View>
                <View className="flex-1">
                  <Paragraph className="line-clamp-1 text-sm">{vn.title}</Paragraph>
                  <Muted type="body-xs">
                    全球 {formatRating(vn.rating)} · 我给 {vn.myVote}
                  </Muted>
                </View>
              </View>
            </Card.Body>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title?: string }): JSX.Element {
  // 取主题 muted（之前写死 iOS 系统灰 #8E8E93，换主题后对不上）
  const muted = useThemeColor("muted");
  return (
    <View className="flex-row items-center gap-2 px-4 py-3">
      <Button size="sm" variant="ghost" onPress={onBack}>
        <Icon name="chevronLeft" size={20} color={muted} />
      </Button>
      {title ? <H5>{title}</H5> : null}
    </View>
  );
}
