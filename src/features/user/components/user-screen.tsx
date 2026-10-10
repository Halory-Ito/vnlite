/**
 * 用户详情页 `/user/[id]`。
 *
 * 数据来自**抓取 VNDB 网站** `/u2`（Kana API 的 `GET /user` 只有 id / username /
 * lengthvotes，官网上的注册时间、投票分布、清单规模、论坛统计全都拿不到）。
 *
 * 入口：讨论列表里的「发起自 / 最后回复」与帖子页里的作者昵称（站内跳转，
 * 不开浏览器）。页面本身分成三块：概览数字 / 资料行 / 打分分布 + 近期打分。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { Chip, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BackBar } from "@/components/back-bar";
import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { KeyValueRow, SectionHeader, StatBlock } from "@/components/ui";
import { FavoriteButton } from "@/features/favorite/components/favorite-button";
import { useRecordHistory } from "@/features/history/hooks";
import { useTranslation } from "@/hooks/use-translation";
import { formatCount } from "@/utils/format";

import { useUserProfile } from "../hooks";
import type { VndbRecentVote, VndbUserProfile } from "../scrape";
import { VoteHistogram } from "./vote-histogram";

export function UserScreen(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useUserProfile(id);
  const recordView = useRecordHistory();

  // 记录浏览历史
  useEffect(() => {
    if (data) recordView("user", data.id, data.username);
  }, [data, recordView]);

  return (
    <View className="flex-1">
      <BackBar
        title={data?.username ?? t("user.title")}
        trailing={
          data ? <FavoriteButton type="user" entryId={data.id} title={data.username} /> : undefined
        }
      />
      {isLoading ? (
        <LoadingState label={t("user.loadingProfile")} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <EmptyState title={t("user.notFoundTitle")} description={t("user.notFoundDescription")} />
      ) : (
        <UserContent profile={data} />
      )}
    </View>
  );
}

function UserContent({ profile: p }: { profile: VndbUserProfile }): JSX.Element {
  const { t } = useTranslation();
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="flex-row gap-2 px-4 py-4">
        <StatBlock value={formatCount(p.listVns)} label={t("user.statListVns")} />
        <StatBlock value={formatCount(p.votes)} label={t("user.statVotes")} tone="accent" />
        <StatBlock value={formatCount(p.posts)} label={t("user.statPosts")} />
      </View>

      <SectionHeader title={t("user.profileSection")} />
      <View className="pb-2">
        <KeyValueRow label={t("user.username")}>
          <Muted type="body-sm">{p.username}</Muted>
        </KeyValueRow>
        <KeyValueRow label="ID">
          <Muted type="body-sm">{p.id}</Muted>
        </KeyValueRow>
        {p.registered ? <Row label={t("user.registered")}>{p.registered}</Row> : null}
        {p.playtime ? (
          <Row label={t("user.playtime")}>
            {p.playtime}
            {p.playthroughs != null ? t("user.playthroughs", { count: p.playthroughs }) : null}
          </Row>
        ) : null}
        {p.edits != null ? <Row label={t("user.edits")}>{formatCount(p.edits)}</Row> : null}
        {p.listReleases != null ? (
          <Row label={t("user.listStats")}>
            {t("user.listReleases", { count: formatCount(p.listReleases) })}
          </Row>
        ) : null}
        {p.reviews != null ? (
          <Row label={t("user.reviewsLabel")}>
            {t("user.reviewCount", { count: formatCount(p.reviews) })}
          </Row>
        ) : null}
        {p.threads != null && p.posts != null ? (
          <Row label={t("user.threadsLabel")}>
            {t("user.threadCount", { count: formatCount(p.threads) })}
          </Row>
        ) : null}
      </View>

      {p.traits.length > 0 ? (
        <>
          <SectionHeader title={t("user.traitsSection")} />
          <View className="gap-3 pb-2">
            {p.traits.map((trait) => (
              <View key={trait.group} className="gap-1.5 px-4">
                <Muted type="body-xs" className="font-medium">
                  {trait.group}
                </Muted>
                <View className="flex-row flex-wrap gap-1.5">
                  {trait.names.map((name) => (
                    <Chip key={name} size="sm" variant="soft" color="default" className="shrink-0">
                      <Chip.Label numberOfLines={1}>{name}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {p.voteDistribution.length > 0 ? (
        <>
          <SectionHeader title={t("user.voteDistribution")} />
          <View className="pb-4">
            <VoteHistogram data={p.voteDistribution} />
          </View>
        </>
      ) : null}

      {p.recentVotes.length > 0 ? (
        <>
          <SectionHeader
            title={t("user.recentVotes")}
            /* 「查看全部」进独立页面：完整列表几百条，不能塞进资料页 */
            trailing={<ViewAllVotes userId={p.id} />}
          />
          <RecentVotes votes={p.recentVotes} />
        </>
      ) : null}
    </ScrollView>
  );
}

/** 「近期打分」右侧的查看全部入口 */
function ViewAllVotes({ userId }: { userId: string }): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const accent = useThemeColor("accent");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/user/[id]/votes", params: { id: userId } })}
      className="flex-row items-center gap-0.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={t("user.viewAllLabel")}
    >
      <Muted type="body-xs" className="font-semibold text-accent">
        {t("user.viewAll")}
      </Muted>
      <Icon name="chevronRight" size={12} color={accent} />
    </Pressable>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <KeyValueRow label={label}>
      <Muted type="body-sm">{children}</Muted>
    </KeyValueRow>
  );
}

/** 近期打分：作品名 / 分数 / 日期，整行进作品详情 */
function RecentVotes({ votes }: { votes: VndbRecentVote[] }): JSX.Element {
  const router = useRouter();

  return (
    <View className="pb-2">
      {votes.map((vote) => (
        <Pressable
          key={`${vote.vnId}-${vote.date}`}
          onPress={() => router.push({ pathname: "/vn/[id]", params: { id: vote.vnId } })}
          className="flex-row items-center gap-3 px-4 py-2 active:opacity-60"
        >
          <Muted type="body-sm" className="flex-1" numberOfLines={1}>
            {vote.title}
          </Muted>
          <Muted type="body-xs" className="font-semibold text-accent">
            {vote.score}
          </Muted>
          <Muted type="body-xs" className="w-20 text-right opacity-70">
            {vote.date}
          </Muted>
        </Pressable>
      ))}
      <View className="h-4" />
    </View>
  );
}
