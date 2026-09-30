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
 *   概览 / 角色 / 制作 / 版本 / 截图 / 关联 / 外链
 *
 * 其中截图 / 关联作品 / 外部链接是从概览里**再拆出来**的 ——
 * 它们都是列表型内容，混在概览里既把页面拉得极长，又只能挤在一条窄带里展示。
 *
 * ⚠️ 7 个页签在手机宽度下放不下，所以列表必须走 `Tabs.ScrollView`
 * （`Tabs.List` 只认「唯一子节点是 ScrollView」这个形状来开启滚动模式），
 * 它还会自动把选中的页签滚到视野中间。
 *
 * ## 数据策略
 *
 * 概览一次拿全量字段（含截图 / 关联 / 外链）；角色 / 制作 / 版本各自独立请求，
 * 因为列表页的字段集不含它们，而且不进那个页签就没必要拉。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { Tabs, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { CoverImage } from "@/components/CoverImage";
import { Icon } from "@/components/Icon";
import { ImageViewer, type ViewerImage } from "@/components/ImageViewer";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { H2, Muted } from "@/components/Typo";
import { RatingBadge } from "@/components/ui";
import { UlistQuickButton } from "@/features/ulist/components/UlistQuickButton";
import type { VnDetail } from "@/lib/api/types";
import { devStatusLabel, formatReleased, languageLabel } from "@/utils/format";

import { VnCharactersTab } from "./components/VnCharactersTab";
import { VnExtLinksTab } from "./components/VnExtLinksTab";
import { VnOverviewTab } from "./components/VnOverviewTab";
import { VnRelationsTab } from "./components/VnRelationsTab";
import { VnReleasesTab } from "./components/VnReleasesTab";
import { VnScreenshotsTab } from "./components/VnScreenshotsTab";
import { VnStaffTab } from "./components/VnStaffTab";
import { useVnDetail } from "./hooks";

type TabKey =
  | "overview"
  | "characters"
  | "staff"
  | "releases"
  | "screenshots"
  | "relations"
  | "extlinks";

/**
 * 页签定义表。
 *
 * 集中在这里而不是散在 JSX 里，是为了让「有哪些页签」一眼可见。
 *
 * ⚠️ 七个页签**始终全部显示**，即使某个页签当前作品没有内容 ——
 * 由各页签自己渲染空态。理由：角色 / 制作 / 版本要单独发请求才能知道有没有内容，
 * 拿不到结果前无法预判；如果只有部分页签会消失，页签集合会在不同作品间跳变，
 * 用户会以为「功能没了」。统一显示 + 统一空态更可预测。
 */
const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "overview", label: "概览" },
  { key: "characters", label: "角色" },
  { key: "staff", label: "制作" },
  { key: "releases", label: "版本" },
  { key: "screenshots", label: "截图" },
  { key: "relations", label: "关联" },
  { key: "extlinks", label: "外链" },
] as const;

export default function VnDetailScreen(): JSX.Element {
  const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const detail = useVnDetail(id);
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
      </View>

      <Header vn={vn} onCoverPress={() => setCoverOpen(true)} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex-1">
        <Tabs.List className="mx-3">
          {/* 7 个页签放不下，必须走 ScrollView；它会自动把选中项滚进视野 */}
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
          {/* 只渲染当前页签，避免七个页签的内容都挂在树上 */}
          {tab === "overview" ? <VnOverviewTab vn={vn} /> : null}
          {tab === "characters" ? <VnCharactersTab vnId={vn.id} /> : null}
          {tab === "staff" ? <VnStaffTab vn={vn} /> : null}
          {tab === "releases" ? <VnReleasesTab vnId={vn.id} /> : null}
          {tab === "screenshots" ? <VnScreenshotsTab vn={vn} /> : null}
          {tab === "relations" ? <VnRelationsTab vn={vn} /> : null}
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

function Header({ vn, onCoverPress }: { vn: VnDetail; onCoverPress: () => void }): JSX.Element {
  return (
    <View className="flex-row items-start gap-4 px-4 pb-3">
      <CoverImage
        url={vn.image?.url}
        width={104}
        height={[104, 138]}
        sexual={vn.image?.sexual}
        violence={vn.image?.violence}
        roundedClassName="rounded-lg"
        priority="high"
        accessibilityLabel={`${vn.title} 封面`}
        onPress={onCoverPress}
      />
      <View className="flex-1 gap-1.5">
        <H2 className="shrink">{vn.title}</H2>
        {vn.alttitle ? <Muted type="body-xs">{vn.alttitle}</Muted> : null}
        <RatingBadge rating={vn.rating} votecount={vn.votecount} size="md" />
        <Muted type="body-xs">
          原始均分 {vn.average != null ? vn.average.toFixed(2) : "—"} / 10
        </Muted>
        <UlistQuickButton vnId={vn.id} />
        <Muted type="body-xs">
          {formatReleased(vn.released)}
          {vn.olang ? ` · ${languageLabel(vn.olang)}` : ""}
          {vn.devstatus != null && vn.devstatus !== 0 ? ` · ${devStatusLabel(vn.devstatus)}` : ""}
        </Muted>
      </View>
    </View>
  );
}
