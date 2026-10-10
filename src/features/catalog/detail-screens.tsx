/**
 * 角色 / 制作者 / staff / 标签 四个详情页。
 *
 * 结构高度相似（返回栏 + 头图 + 若干信息行 + 相关 VN 列表），
 * 抽成 `DetailShell` 统一处理导航栏、加载态、错误态；
 * 制作者与 staff 的三档页签（概览 / 作品 / 外链）抽成 `CatalogDetailTabs`
 * （同目录 `components/`）—— 这两个页面除了文案一模一样。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CollapsibleText, ExpandToggle, useCollapsedList } from "@/components/collapsible";
import { CoverImage } from "@/components/cover-image";
import { Icon } from "@/components/icon";
import { ImageViewer, type ViewerImage } from "@/components/image-viewer";
import { Divider, Separator } from "@/components/separator";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { H2, H6, Muted } from "@/components/typo";
import { KeyValueRow, SectionHeader, TagChip } from "@/components/ui";
import { FavoriteButton } from "@/features/favorite/components/favorite-button";
import { useRecordHistory } from "@/features/history/hooks";
import { VnListItem } from "@/features/vn/components/vn-list-item";
import { useTranslation } from "@/hooks/use-translation";

import { CatalogDetailTabs, type CatalogTab } from "./components/catalog-detail-tabs";
import { ProducerLogo } from "./components/producer-logo";
import { useProducerLogoUrl } from "./use-kungal-logo";
import {
  getCharacter,
  getProducer,
  getStaff,
  getTag,
  queryVnsByCharacter,
  queryVnsByDeveloper,
  queryVnsByStaff,
  queryVnsByTagId,
} from "@/lib/api/endpoints/catalog";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import type { VnSummary } from "@/lib/api/types";
import { setPreference } from "@/lib/storage/preferences";
import { usePreferences } from "@/hooks/use-preferences";
import { formatCount, producerTypeLabel, sexLabel } from "@/utils/format";

/* -------------------------------------------------------------------------- */
/* 通用外壳                                                                    */
/* -------------------------------------------------------------------------- */

/** 角色特性默认显示几个（VNDB 的角色特性动辄几十条） */
const TRAIT_LIMIT = 12;

interface DetailShellProps {
  title: string;
  subtitle?: string;
  cover?: ReactNode;
  header?: ReactNode;
  /** 顶栏右侧操作区（如收藏星标） */
  trailing?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  children?: ReactNode;
  /**
   * 内容是否包在 `ScrollView` 里（默认 true）。
   * 需要**自己管滚动**的页面（制作者 / staff 详情的 `CatalogDetailTabs`，
   * 每个页签各自滚）传 false。
   */
  scrollable?: boolean;
}

function DetailShell({
  title,
  subtitle,
  cover,
  header,
  trailing,
  isLoading,
  isError,
  error,
  onRetry,
  children,
  scrollable = true,
}: DetailShellProps): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const muted = useThemeColor("muted");

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;

  const body = (
    <>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="active:opacity-60"
          accessibilityLabel={t("common.back")}
        >
          {/* 返回箭头取主题 muted，之前写死 iOS 系统灰 #8E8E93，换主题后对不上 */}
          <Icon name="chevronLeft" size={24} color={muted} />
        </Pressable>
        <Muted type="body-sm" className="flex-1" numberOfLines={1}>
          {title}
        </Muted>
        {trailing}
      </View>

      <View className="flex-row items-start gap-4 px-4 pb-4">
        {cover}
        <View className="flex-1 gap-2">
          <H2 className="shrink">{title}</H2>
          {subtitle ? <Muted type="body-xs">{subtitle}</Muted> : null}
          {header}
        </View>
      </View>

      {children}
    </>
  );

  // 自己管滚动的页面（页签）不要套 ScrollView，否则列表型内容会被撑开
  if (!scrollable) return <View className="flex-1">{body}</View>;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
      <View>{body}</View>
    </ScrollView>
  );
}
/** 底部「相关作品」列表 */
function RelatedVns({
  vns,
  isLoading,
  isError,
  error,
  onRetry,
  title,
}: {
  vns: { id: string; title?: string }[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  title: string;
}): JSX.Element | null {
  const router = useRouter();
  const { t } = useTranslation();
  // 封面查看器：null = 关着（整段列表共用一个）
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { covers, coverIndex } = useMemo(() => {
    const images: ViewerImage[] = [];
    const index = new Map<string, number>();
    for (const vn of vns ?? []) {
      const url = (vn as VnSummary).image?.url;
      if (!url) continue;
      index.set(vn.id, images.length);
      images.push({
        url,
        thumbnail: (vn as VnSummary).image?.thumbnail,
        dims: (vn as VnSummary).image?.dims,
        sexual: (vn as VnSummary).image?.sexual,
        violence: (vn as VnSummary).image?.violence,
        label: t("home.coverLabel", { title: vn.title ?? vn.id }),
      });
    }
    return { covers: images, coverIndex: index };
  }, [vns, t]);

  if (isLoading) return <LoadingState label={t("common.loading")} className="py-8" />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (!vns || vns.length === 0) return null;

  return (
    <>
      <Divider />
      <SectionHeader title={title} />
      <View>
        {vns.map((vn) => (
          <View key={vn.id}>
            <VnListItem
              vn={vn as VnSummary}
              onPress={(id) => router.push(`/vn/${id}`)}
              onCoverPress={() => setViewerIndex(coverIndex.get(vn.id) ?? null)}
              fields={["rating", "released", "olang"]}
            />
            <Separator />
          </View>
        ))}
      </View>

      <ImageViewer
        images={covers}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 角色                                                                        */
/* -------------------------------------------------------------------------- */

export function CharacterDetailScreen(): JSX.Element {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const recordView = useRecordHistory();

  const detail = useQuery({
    queryKey: queryKeys.character.detail(id),
    queryFn: ({ signal }) => getCharacter(id, signal),
    staleTime: STALE_TIME.catalog,
    select: (d) => d.results[0],
  });

  const vns = useQuery({
    queryKey: queryKeys.character.vns(id),
    queryFn: ({ signal }) => queryVnsByCharacter(id, signal),
    staleTime: STALE_TIME.catalog,
    select: (d) => d.results as VnSummary[],
  });

  const c = detail.data;

  // 记录浏览历史
  useEffect(() => {
    if (c) recordView("character", c.id, c.name, c.original, c.image?.thumbnail);
  }, [c, recordView]);
  // 特性可能有几十条（VNDB 的角色特性是「标签墙」），默认只铺 12 个
  const traits = useCollapsedList(c?.traits ?? [], TRAIT_LIMIT);

  return (
    <DetailShell
      title={c?.name ?? t("catalog.characterFallback")}
      subtitle={c?.original && c.original !== c.name ? c.original : undefined}
      trailing={
        c ? (
          <FavoriteButton
            type="character"
            entryId={c.id}
            title={c.name}
            subtitle={c.original}
            imageUrl={c.image?.thumbnail}
          />
        ) : undefined
      }
      isLoading={detail.isLoading}
      isError={detail.isError}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      cover={
        <CoverImage
          url={c?.image?.url}
          width={110}
          height={[110, 147]}
          sexual={c?.image?.sexual}
          violence={c?.image?.violence}
          roundedClassName="rounded-lg"
          priority="high"
        />
      }
    >
      {c ? (
        <>
          <Divider />
          <View className="py-2">
            <KeyValueRow label={t("catalog.sex")}>
              <Muted type="body-sm">{sexLabel(c.sex)}</Muted>
            </KeyValueRow>
            {c.age ? (
              <KeyValueRow label={t("catalog.age")}>
                <Muted type="body-sm">
                  {c.age[0] === c.age[1] ? `${c.age[0]}` : `${c.age[0]}–${c.age[1]}`}
                </Muted>
              </KeyValueRow>
            ) : null}
            {c.birthday ? (
              <KeyValueRow label={t("catalog.birthday")}>
                <Muted type="body-sm">
                  {c.birthday[1]
                    ? t("catalog.birthdayFormat", { month: c.birthday[0], day: c.birthday[1] })
                    : t("catalog.birthdayMonth", { month: c.birthday[0] })}
                </Muted>
              </KeyValueRow>
            ) : null}
            {c.blood_type ? (
              <KeyValueRow label={t("catalog.bloodType")}>
                <Muted type="body-sm">{c.blood_type}</Muted>
              </KeyValueRow>
            ) : null}
            {c.cup || c.bust ? (
              <KeyValueRow label={t("catalog.body")}>
                {c.cup ? <Muted type="body-sm">{c.cup}</Muted> : null}
                {c.bust ? <Muted type="body-xs">{t("catalog.bust", { cm: c.bust })}</Muted> : null}
              </KeyValueRow>
            ) : null}
          </View>

          {c.traits && c.traits.length > 0 ? (
            <>
              <Divider />
              <SectionHeader title={t("catalog.traits")} />
              <View className="gap-2">
                <View className="flex-row flex-wrap gap-1.5 px-4">
                  {traits.shown.map((trait) => (
                    <TagChip
                      key={trait.id}
                      id={trait.id}
                      name={trait.name}
                      spoiler={trait.spoiler ?? 0}
                    />
                  ))}
                </View>
                {traits.truncated ? (
                  <View className="px-4 pb-2">
                    <ExpandToggle expanded={traits.expanded} onPress={traits.toggle} />
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {c.description ? (
            <>
              <Divider />
              <SectionHeader title={t("catalog.description")} />
              <View className="px-4 pb-4">
                <CollapsibleText text={c.description} lines={6} />
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <RelatedVns
        vns={vns.data}
        isLoading={vns.isLoading}
        isError={vns.isError}
        error={vns.error}
        onRetry={() => void vns.refetch()}
        title={t("catalog.relatedVns")}
      />
    </DetailShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 制作者                                                                      */
/* -------------------------------------------------------------------------- */

export function ProducerDetailScreen(): JSX.Element {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const viewMode = usePreferences().vnViewMode;
  const [tab, setTab] = useState<CatalogTab>("overview");
  const recordView = useRecordHistory();

  const detail = useQuery({
    queryKey: queryKeys.producer.detail(id),
    queryFn: ({ signal }) => getProducer(id, signal),
    staleTime: STALE_TIME.catalog,
    select: (d) => d.results[0],
  });

  const vns = useQuery({
    queryKey: ["producer", "vns", id],
    queryFn: ({ signal }) => queryVnsByDeveloper(id, signal),
    staleTime: STALE_TIME.catalog,
    select: (d) => d.results as VnSummary[],
    enabled: Boolean(id),
  });

  const p = detail.data;
  const logoUrl = useProducerLogoUrl(p);

  // 记录浏览历史（LOGO 解析出来后再补一次，历史行就能显示厂商 LOGO）
  useEffect(() => {
    if (p) recordView("producer", p.id, p.name, p.original, logoUrl);
  }, [p, logoUrl, recordView]);

  return (
    <DetailShell
      title={p?.name ?? t("catalog.producerFallback")}
      subtitle={p?.original && p.original !== p.name ? p.original : undefined}
      trailing={
        p ? (
          <FavoriteButton
            type="producer"
            entryId={p.id}
            title={p.name}
            subtitle={p.original}
            imageUrl={logoUrl}
          />
        ) : undefined
      }
      cover={p ? <ProducerLogo producer={p} /> : undefined}
      isLoading={detail.isLoading}
      isError={detail.isError}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      // 页签各自管滚动（`CatalogDetailTabs` 内部有 ScrollView），外壳不要再套一层
      scrollable={false}
      header={
        p ? (
          <View className="self-start rounded bg-default-soft px-2 py-0.5">
            <Muted type="body-xs">{producerTypeLabel(p.type)}</Muted>
          </View>
        ) : null
      }
    >
      <CatalogDetailTabs
        tab={tab}
        onTabChange={setTab}
        overview={
          p?.description ? (
            <>
              <SectionHeader title={t("catalog.description")} />
              <View className="px-4 pb-4">
                <CollapsibleText text={p.description} />
              </View>
            </>
          ) : (
            <View className="px-4 py-4">
              <Muted type="body-sm">{t("catalog.producerNoDescription")}</Muted>
            </View>
          )
        }
        works={{
          isLoading: vns.isLoading,
          isError: vns.isError,
          error: vns.error,
          onRetry: () => void vns.refetch(),
          items: vns.data ?? [],
        }}
        emptyWorksText={t("catalog.worksEmptyProducer")}
        extlinks={p?.extlinks}
        emptyExtlinksText={t("catalog.extlinksEmptyProducer")}
        onPressVn={(vnId) => router.push(`/vn/${vnId}`)}
        viewMode={viewMode}
        onChangeViewMode={(mode) => void setPreference("vnViewMode", mode)}
      />
    </DetailShell>
  );
}

/* -------------------------------------------------------------------------- */
/* staff                                                                       */
/* -------------------------------------------------------------------------- */

export function StaffDetailScreen(): JSX.Element {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const viewMode = usePreferences().vnViewMode;
  const [tab, setTab] = useState<CatalogTab>("overview");
  const recordView = useRecordHistory();

  const detail = useQuery({
    queryKey: queryKeys.staff.detail(id),
    queryFn: ({ signal }) => getStaff(id, signal),
    staleTime: STALE_TIME.catalog,
    select: (d) => d.results[0],
  });

  const vns = useQuery({
    queryKey: queryKeys.staff.vns(id),
    queryFn: ({ signal }) => queryVnsByStaff(id, signal),
    staleTime: STALE_TIME.catalog,
    select: (d) => d.results as VnSummary[],
    enabled: Boolean(id),
  });

  const s = detail.data;

  // 记录浏览历史
  useEffect(() => {
    if (s) recordView("staff", s.id, s.name, s.original);
  }, [s, recordView]);

  return (
    <DetailShell
      title={s?.name ?? t("catalog.staffFallback")}
      subtitle={s?.original && s.original !== s.name ? s.original : undefined}
      trailing={
        s ? (
          <FavoriteButton type="staff" entryId={s.id} title={s.name} subtitle={s.original} />
        ) : undefined
      }
      isLoading={detail.isLoading}
      isError={detail.isError}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      // 页签各自管滚动（同制作者页）
      scrollable={false}
    >
      <CatalogDetailTabs
        tab={tab}
        onTabChange={setTab}
        overview={
          s?.description ? (
            <>
              <SectionHeader title={t("catalog.description")} />
              <View className="px-4 pb-4">
                <CollapsibleText text={s.description} />
              </View>
            </>
          ) : (
            <View className="px-4 py-4">
              <Muted type="body-sm">{t("catalog.staffNoDescription")}</Muted>
            </View>
          )
        }
        works={{
          isLoading: vns.isLoading,
          isError: vns.isError,
          error: vns.error,
          onRetry: () => void vns.refetch(),
          items: vns.data ?? [],
        }}
        emptyWorksText={t("catalog.worksEmptyStaff")}
        extlinks={s?.extlinks}
        emptyExtlinksText={t("catalog.extlinksEmptyStaff")}
        onPressVn={(vnId) => router.push(`/vn/${vnId}`)}
        viewMode={viewMode}
        onChangeViewMode={(mode) => void setPreference("vnViewMode", mode)}
      />
    </DetailShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 标签                                                                        */
/* -------------------------------------------------------------------------- */

export function TagDetailScreen(): JSX.Element {
  const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  // ⚠️ 这条数据变量就叫 `t`（标签），翻译函数改名 `tr` 避免撞名
  const { t: tr } = useTranslation();
  // `tag` 含父标签继承，`dtag` 只取直接标签
  const [direct, setDirect] = useState(false);

  const detail = useQuery({
    queryKey: queryKeys.tag.detail(id),
    queryFn: ({ signal }) => getTag(id, signal),
    staleTime: STALE_TIME.taxonomy,
    select: (d) => d.results[0],
  });

  const vns = useQuery({
    queryKey: queryKeys.tag.vns(id, direct),
    queryFn: ({ signal }) => queryVnsByTagId(id, direct, signal),
    staleTime: STALE_TIME.taxonomy,
    select: (d) => d.results as VnSummary[],
    enabled: Boolean(id),
  });

  const t = detail.data;

  return (
    <DetailShell
      title={t?.name ?? tr("catalog.tagFallback")}
      subtitle={t?.category}
      isLoading={detail.isLoading}
      isError={detail.isError}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      header={
        t?.vn_count != null ? (
          <Muted type="body-xs">{tr("catalog.tagCount", { count: formatCount(t.vn_count) })}</Muted>
        ) : null
      }
    >
      {t?.description ? (
        <>
          <Divider />
          <SectionHeader title={tr("catalog.tagDescription")} />
          <View className="px-4 pb-4">
            <CollapsibleText text={t.description} />
          </View>
        </>
      ) : null}

      <Divider />
      <View className="flex-row items-center gap-3 px-4 py-2">
        <H6>{tr("catalog.tagWorksTitle")}</H6>
        <Pressable onPress={() => setDirect(!direct)} className="active:opacity-60">
          <Muted type="body-xs" className="text-link">
            {direct ? tr("catalog.tagDirectOnly") : tr("catalog.tagInherited")}
          </Muted>
        </Pressable>
      </View>

      {vns.isLoading ? (
        <LoadingState label={tr("common.loading")} className="py-8" />
      ) : vns.isError ? (
        <ErrorState error={vns.error} onRetry={() => void vns.refetch()} />
      ) : (vns.data ?? []).length === 0 ? (
        <EmptyState title={tr("catalog.tagWorksEmpty")} />
      ) : (
        <View>
          {(vns.data ?? []).map((vn) => (
            <View key={vn.id}>
              {/* 标签页里作品卡片不带平台：这里的列表本来就是「这个标签下有什么」 */}
              <VnListItem
                vn={vn}
                onPress={(nextId) => router.push(`/vn/${nextId}`)}
                fields={["rating", "released", "olang", "length"]}
              />
              <Separator />
            </View>
          ))}
        </View>
      )}
    </DetailShell>
  );
}
