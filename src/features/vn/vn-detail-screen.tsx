/**
 * VN 详情页。
 *
 * 结构：头部固定 + 内容分 Tabs。
 *
 * ## 为什么页签要拆这么细
 *
 * 详情页内容极长，以前要一路滚到底才能看到角色和发行版，滚动本身也浪费渲染。
 * 现在每个「列表型内容」都独立成页签：
 *
 *   概览 / 角色 / 制作 / 版本 / 截图 / 关联 / 语录 / 讨论 / 攻略 / 外链
 *
 * 其中截图 / 关联作品 / 语录 / 讨论 / 攻略 / 外部链接是从概览里**再拆出来**的 ——
 * 它们都是列表型内容，混在概览里既把页面拉得极长，又只能挤在一条窄带里展示。
 *
 * ⚠️ 10 个页签在手机宽度下放不下，所以列表必须走 `Tabs.ScrollView`
 * （`Tabs.List` 只认「唯一子节点是 ScrollView」这个形状来开启滚动模式），
 * 它还会自动把选中的页签滚到视野中间。
 *
 * ## 数据策略
 *
 * 概览一次拿全量字段（含截图 / 关联 / 外链）；角色 / 制作 / 版本 / 语录 / 讨论 / 攻略
 * 各自独立请求，因为列表页的字段集不含它们，而且不进那个页签就没必要拉。
 * 其中「讨论」抓的是 VNDB **网站 HTML**（Kana API 没有讨论端点），见 features/discussion；
 * 「攻略」走的是独立的静态 JSON 仓库（API 同样没有），见 features/walkthrough。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { Chip, Tabs, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Icon } from "@/components/icon";
import { ImageViewer, type ViewerImage } from "@/components/image-viewer";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { H3, Muted } from "@/components/typo";
import { StatBlock } from "@/components/ui";
import { VnDiscussionsTab } from "@/features/discussion/components/vn-discussions-tab";
import { UlistEditEntry } from "@/features/ulist/components/ulist-edit-entry";
import { UlistToggleButton } from "@/features/ulist/components/ulist-toggle-button";
import { useUlistItem } from "@/features/ulist/hooks";
import { VnWalkthroughTab } from "@/features/walkthrough/components/walkthrough-tab";
import { useSession } from "@/hooks/use-session";
import type { VnDetail } from "@/lib/api/types";
import {
  devStatusLabel,
  formatCount,
  formatLength,
  formatMinutes,
  formatRating,
  formatReleased,
} from "@/utils/format";

import { VnCharactersTab } from "./components/vn-characters-tab";
import { VnExtLinksTab } from "./components/vn-ext-links-tab";
import { VnOverviewTab } from "./components/vn-overview-tab";
import { VnQuotesTab } from "./components/vn-quotes-tab";
import { VnRelationsTab } from "./components/vn-relations-tab";
import { VnReleasesTab } from "./components/vn-releases-tab";
import { VnScreenshotsTab } from "./components/vn-screenshots-tab";
import { VnStaffTab } from "./components/vn-staff-tab";
import { useVnDetail } from "./hooks";

type TabKey =
  | "overview"
  | "characters"
  | "staff"
  | "releases"
  | "screenshots"
  | "relations"
  | "quotes"
  | "discussions"
  | "walkthrough"
  | "extlinks";

/**
 * 页签定义表。
 *
 * 集中在这里而不是散在 JSX 里，是为了让「有哪些页签」一眼可见。
 *
 * ⚠️ 页签**始终全部显示**，即使某个页签当前作品没有内容 ——
 * 由各页签自己渲染空态。理由：角色 / 制作 / 版本要单独发请求才能知道有没有内容，
 * 拿不到结果前无法预判；如果只有部分页签会消失，页签集合会在不同作品间跳变，
 * 用户会以为「功能没了」。统一显示 + 统一空态更可预测。
 *
 * ⚠️ 没有「评价」页签：Kana API 不提供 reviews（只有 `/vn` 的 `has_review` 布尔过滤器），
 * 拿不到正文 / 作者 / 分数，所以只做 API 支持得起的「语录」。
 * 「讨论」页签的数据走抓取 VNDB 网站（API 同样没有讨论端点），见 features/discussion。
 * 「攻略」页签的数据走独立仓库的静态 JSON（API 也没有），见 features/walkthrough。
 */
const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "overview", label: "概览" },
  { key: "characters", label: "角色" },
  { key: "staff", label: "制作" },
  { key: "releases", label: "版本" },
  { key: "screenshots", label: "截图" },
  { key: "relations", label: "关联" },
  { key: "quotes", label: "语录" },
  { key: "discussions", label: "讨论" },
  { key: "walkthrough", label: "攻略" },
  { key: "extlinks", label: "外链" },
] as const;

export default function VnDetailScreen(): JSX.Element {
  const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const detail = useVnDetail(id);
  // 我的打分（三列概览的第一列）：登录就能读自己的清单，不要求 listwrite
  const session = useSession();
  const isLoggedIn = session.status === "authenticated";
  const myListItem = useUlistItem(id, isLoggedIn);
  const [tab, setTab] = useState<TabKey>("overview");
  // 封面查看器：false = 关着
  const [coverOpen, setCoverOpen] = useState(false);
  // 箭头图标取主题 muted（不能写死 iOS 系统灰 #8E8E93，换主题后对不上）
  const muted = useThemeColor("muted");

  if (detail.isLoading) return <LoadingState label="加载作品信息…" />;
  if (detail.isError)
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;

  const vn = detail.data;
  if (!vn) return <EmptyState title="作品不存在" description="它可能已从 VNDB 删除" />;

  const myVote = myListItem.data?.vote ?? null;
  // 游玩状态 = 我的清单标签里的状态标签（Playing / Finished / …，VNDB 英文原名）
  const playStatus =
    (myListItem.data?.labels ?? []).find((label) => label.id >= 1 && label.id <= 5)?.label ?? null;

  const coverImages: ViewerImage[] = vn.image?.url
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
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          className="active:opacity-60"
          accessibilityLabel="返回"
          hitSlop={8}
        >
          <Icon name="chevronLeft" size={24} color={muted} />
        </Pressable>
        <Muted type="body-sm" className="flex-1">
          {vn.id}
        </Muted>
        {/* 右上角：先「编辑」（改状态 / 打分 / 标签），再「加入 / 移出清单」 */}
        <UlistEditEntry vnId={vn.id} />
        <UlistToggleButton vnId={vn.id} />
      </View>

      <Header
        vn={vn}
        playStatus={playStatus}
        myVote={myVote}
        onCoverPress={() => setCoverOpen(true)}
      />

      {/* 三列概览：评价人数 / 均分 / 游玩时长（信息 Tabs 上方） */}
      <View className="flex-row gap-2 px-4 pb-3">
        <StatBlock value={formatCount(vn.votecount)} label="评价人数" />
        <StatBlock value={formatRating(vn.rating)} label="均分" tone="accent" />
        <StatBlock
          value={
            vn.length_minutes != null
              ? (formatMinutes(vn.length_minutes) ?? "—")
              : formatLength(vn.length)
          }
          label="游玩时长"
        />
      </View>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex-1">
        <Tabs.List className="mx-3">
          {/* 10 个页签放不下，必须走 ScrollView；它会自动把选中项滚进视野 */}
          <Tabs.ScrollView>
            {/* ⚠️ 指示块要自己挂：HeroUI 不会自动注入，漏了就没有「选中」的底色 */}
            <Tabs.Indicator />
            {TABS.map((t) => (
              <Tabs.Trigger key={t.key} value={t.key}>
                <Tabs.Label>{t.label}</Tabs.Label>
              </Tabs.Trigger>
            ))}
          </Tabs.ScrollView>
        </Tabs.List>

        <View className="flex-1">
          {/* 只渲染当前页签，避免九个页签的内容都挂在树上 */}
          {tab === "overview" ? <VnOverviewTab vn={vn} /> : null}
          {tab === "characters" ? <VnCharactersTab vnId={vn.id} /> : null}
          {tab === "staff" ? <VnStaffTab vn={vn} /> : null}
          {tab === "releases" ? <VnReleasesTab vnId={vn.id} /> : null}
          {tab === "screenshots" ? <VnScreenshotsTab vn={vn} /> : null}
          {tab === "relations" ? <VnRelationsTab vn={vn} /> : null}
          {tab === "quotes" ? <VnQuotesTab vnId={vn.id} /> : null}
          {tab === "discussions" ? <VnDiscussionsTab vnId={vn.id} /> : null}
          {tab === "walkthrough" ? <VnWalkthroughTab vnId={vn.id} /> : null}
          {tab === "extlinks" ? <VnExtLinksTab vn={vn} /> : null}
        </View>
      </Tabs>

      <ImageViewer
        images={coverImages}
        index={coverOpen ? 0 : null}
        onClose={() => setCoverOpen(false)}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 头部                                                                        */
/* -------------------------------------------------------------------------- */

function Header({
  vn,
  playStatus,
  myVote,
  onCoverPress,
}: {
  vn: VnDetail;
  /** 我的游玩状态（Playing / Finished / …），不在清单里时为 null */
  playStatus: string | null;
  /** 我的评分，未打分时为 null */
  myVote: number | null;
  onCoverPress: () => void;
}): JSX.Element {
  const router = useRouter();
  // 只显示第一个开发商（VNDB 的开发商列表常有重复条目，全铺会把头部撑长）
  const developer = vn.developers?.[0];
  const inDevelopment = vn.devstatus === 1;
  const cancelled = vn.devstatus === 2;

  return (
    <View className="flex-row items-start gap-4 px-4 pb-3">
      <CoverImage
        url={vn.image?.url}
        width={124}
        height={[104, 138]}
        sexual={vn.image?.sexual}
        violence={vn.image?.violence}
        roundedClassName="rounded-lg"
        priority="high"
        accessibilityLabel={`${vn.title} 封面`}
        onPress={onCoverPress}
      />
      <View className="flex-1 gap-2">
        {/* 标题用 H3（比原来的 H2 小一号）：封面放大后，信息列要装得下更多行 */}
        <H3 className="shrink">{vn.title}</H3>
        {vn.alttitle ? <Muted type="body-xs">{vn.alttitle}</Muted> : null}

        {/*
         * 值 chip 行：游玩状态 / 我的评分 / 发行日期 / 开发商（只第一个）。
         * 均分与评价人数**不在这里** —— 三列概览已经显示，不再重复。
         * 一律只放值、不放 label（Master 要求）；开发中 / 已取消的徽标例外，
         * 它没有别处可显示，去掉就等于丢信息。
         *
         * ⚠️ `shrink-0` + `numberOfLines={1}` 是**修 bug**，不是装饰：
         * VNDB 的名字带空格（如 `Alice Soft`），chip 在换行行里被压缩时
         * 标签会折行、被 `overflow: hidden` 裁掉后半截 —— 表现是「只显示 Alice
         * 加一截空白」。`shrink-0` 让它换行而不是被压扁，`numberOfLines` 保证单行。
         */}
        <View className="flex-row flex-wrap items-center gap-1.5">
          {playStatus ? (
            <Chip size="sm" variant="soft" color="accent" className="shrink-0">
              <Chip.Label numberOfLines={1}>{playStatus.trim()}</Chip.Label>
            </Chip>
          ) : null}
          {myVote != null ? (
            <Chip size="sm" variant="soft" color="default" className="shrink-0">
              <Chip.Label numberOfLines={1}>{String(myVote)}</Chip.Label>
            </Chip>
          ) : null}
          <Chip size="sm" variant="soft" color="default" className="shrink-0">
            <Chip.Label numberOfLines={1}>{formatReleased(vn.released).trim()}</Chip.Label>
          </Chip>
          {developer ? (
            <Chip
              size="sm"
              variant="soft"
              color="default"
              className="shrink-0"
              onPress={() => router.push(`/producer/${developer.id}`)}
            >
              <Chip.Label numberOfLines={1}>{developer.name.trim()}</Chip.Label>
            </Chip>
          ) : null}
          {inDevelopment || cancelled ? (
            <Chip
              size="sm"
              variant="soft"
              color={cancelled ? "danger" : "warning"}
              className="shrink-0"
            >
              <Chip.Label numberOfLines={1}>{devStatusLabel(vn.devstatus)}</Chip.Label>
            </Chip>
          ) : null}
        </View>
      </View>
    </View>
  );
}
