/**
 * 首页。
 *
 * 板块三个：
 *   1. 每日语录（当天固定一条，跨启动不变）
 *   2. 随机一部（真随机：最大 id + 随机号段，见 `queryRandomVn`；**摇一摇**也能换）
 *   3. 数据库统计（VNDB 全局条目数图表，`features/stats/database-stats`）
 *
 * 原来的常用入口（我的游戏 / 评分排行 / 我的评分排名 / 近期热门 / 收藏统计）
 * 全部移除：前四个与底部 Tab、「浏览」页重复，收藏统计挪进「我的」。
 * 「最新上架」分区更早就去掉了（和「浏览 · 按发售时间」重复）。
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Button, Card, Skeleton, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Icon } from "@/components/icon";
import { ImageViewer } from "@/components/image-viewer";
import { Muted, Paragraph } from "@/components/typo";
import { DatabaseStats } from "@/features/stats/database-stats";
import { useShake } from "@/hooks/use-shake";
import { queryRandomQuote, queryRandomVn } from "@/lib/api/endpoints/vn";
import type { VnSummary } from "@/lib/api/types";
import { readDailyQuote, writeDailyQuote } from "@/lib/storage/daily-quote";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import {
  formatMonthDay,
  formatRating,
  formatReleased,
  languageLabel,
  todayIso,
} from "@/utils/format";

export default function HomeTab(): JSX.Element {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <QuoteCard />
      <RandomVnCard />
      <DatabaseStats />
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* 每日语录                                                                    */
/* -------------------------------------------------------------------------- */

function QuoteCard(): JSX.Element | null {
  const router = useRouter();
  const dateKey = todayIso();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.quote.ofTheDay(dateKey),
    /*
     * 「每日」的语义：当天第一次打开抽一条，之后整天不变。
     * 内存里由 React Query 缓存（key 带日期），落盘由 `dailyQuote` 负责 ——
     * 杀进程重开也是同一条，跨天 key 变化自动换新。
     */
    queryFn: async ({ signal }) => {
      const cached = await readDailyQuote(dateKey);
      if (cached) return cached;
      const fresh = await queryRandomQuote(signal);
      const quote = fresh.results[0];
      if (quote) await writeDailyQuote(quote, dateKey);
      return quote;
    },
    staleTime: STALE_TIME.quote,
  });

  // 骨架屏：以前这里直接返回一个 h-2 的空白，首屏会「什么都没有 → 突然出现一张卡」
  if (isLoading) {
    return (
      <Card className="mx-4 my-3">
        <Card.Body className="gap-2.5">
          <Skeleton variant="pulse" className="h-4 w-full rounded-md" />
          <Skeleton variant="pulse" className="h-4 w-3/5 rounded-md" />
          <Skeleton variant="pulse" className="h-3 w-1/3 rounded-md" />
        </Card.Body>
      </Card>
    );
  }

  if (!data?.quote) return null;

  return (
    <Card className="mx-4 my-3">
      <Card.Body>
        <View className="mb-1 flex-row items-center justify-between">
          <Muted type="body-xs" className="font-medium">
            每日语录
          </Muted>
          <Muted type="body-xs">{formatMonthDay(dateKey)}</Muted>
        </View>
        <Paragraph>「{data.quote}」</Paragraph>
        {data.vn ? (
          <Pressable
            onPress={() => router.push(`/vn/${data.vn?.id}`)}
            className="mt-2 self-start active:opacity-60"
          >
            <Muted type="body-sm" className="text-link">
              — {data.vn.title}
            </Muted>
          </Pressable>
        ) : null}
      </Card.Body>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 随机一部                                                                    */
/* -------------------------------------------------------------------------- */

function RandomVnCard(): JSX.Element {
  const router = useRouter();
  // 按钮上的图标跟标签同色，不能写死白色（换主题后 primary 按钮的前景会变）
  const accentForeground = useThemeColor("accent-foreground");
  // round 进 queryKey：点一次「换一部」= 一次新查询，随机逻辑放在 queryFn 里
  const [round, setRound] = useState(0);

  const pick = useQuery({
    queryKey: queryKeys.vn.random(round),
    queryFn: ({ signal }) => queryRandomVn(signal),
    staleTime: STALE_TIME.vn,
    // 随机失败再自动重试没意义（点一次就是一次）
    retry: false,
  });

  const reshuffle = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRound((r) => r + 1);
  };

  // 摇一摇 = 换一部（和点按钮同一条路径；首页本来就是「摇一部来玩」的语境）
  useShake(reshuffle);

  return (
    <Card className="mx-4 my-3">
      <Card.Body>
        {pick.data ? (
          <RandomVnRow vn={pick.data} onPress={() => router.push(`/vn/${pick.data?.id}`)} />
        ) : null}
        {pick.isError ? (
          <Muted type="body-sm">
            随机失败：{pick.error instanceof Error ? pick.error.message : "未知错误"}
          </Muted>
        ) : null}
        {pick.isLoading ? (
          // 骨架屏：和卡片实际结构对齐（封面 + 两行文字）
          <View className="flex-row gap-3">
            <Skeleton variant="pulse" className="h-[93px] w-[70px] rounded-md" />
            <View className="flex-1 justify-center gap-2">
              <Skeleton variant="pulse" className="h-4 w-full rounded-md" />
              <Skeleton variant="pulse" className="h-3 w-2/5 rounded-md" />
            </View>
          </View>
        ) : null}
      </Card.Body>
      <Card.Footer className="flex-row items-center justify-between gap-3 pt-3">
        <Muted type="body-xs">摇一摇手机也能换</Muted>
        <Button size="sm" onPress={reshuffle} isDisabled={pick.isFetching}>
          <Icon name="shuffle" size={16} color={accentForeground} />
          <Button.Label>换一部</Button.Label>
        </Button>
      </Card.Footer>
    </Card>
  );
}

function RandomVnRow({ vn, onPress }: { vn: VnSummary; onPress: () => void }): JSX.Element {
  // 封面查看器：null = 关着（这张卡只有一张图）
  const [coverOpen, setCoverOpen] = useState(false);
  const cover = vn.image?.url
    ? [
        {
          url: vn.image.url,
          thumbnail: vn.image.thumbnail,
          dims: vn.image.dims,
          sexual: vn.image.sexual,
          violence: vn.image.violence,
          label: `${vn.title} 封面`,
        },
      ]
    : [];

  return (
    <>
      <Pressable onPress={onPress} className="active:opacity-60">
        <View className="flex-row gap-3">
          <CoverImage
            url={vn.image?.thumbnail ?? vn.image?.url}
            width={70}
            height={[70, 93]}
            sexual={vn.image?.sexual}
            violence={vn.image?.violence}
            accessibilityLabel={`${vn.title} 封面`}
            onPress={() => setCoverOpen(true)}
          />
          <View className="flex-1 justify-center">
            <Paragraph className="line-clamp-2">{vn.title}</Paragraph>
            <Muted type="body-xs">
              {formatReleased(vn.released)} · {languageLabel(vn.olang)} · {formatRating(vn.rating)}
            </Muted>
          </View>
        </View>
      </Pressable>

      <ImageViewer
        images={cover}
        index={coverOpen ? 0 : null}
        onClose={() => setCoverOpen(false)}
      />
    </>
  );
}
