/**
 * VN 详情 · 截图页签。
 *
 * 拆成独立页签的原因：截图是**列表型内容**，一屏能放好几张，
 * 塞在概览里只能横向滚一条窄带，而且会把概览拉到很长。
 *
 * 布局按屏幕分档（`utils/grid#screenshotColumns`）：手机单列大图，
 * iPad mini 3 列、大平板 4 列 —— 平板上单列会浪费掉大半屏宽度。
 * 每张图仍按原始宽高比（`dims`）出图，点任意一张进全屏查看器。
 *
 * ⚠️ 用 FlashList 而不是 `ScrollView + map`：截图原图一张 ~130 KB，
 * 二十张一次性挂载就是两三 MB 同时排队，进页面会长时间白着。
 * 虚拟化后只请求视野内的几张，缩略图（~8 KB）先铺底。
 */

import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer";
import { EmptyState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { useImageGate } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { VnDetail } from "@/lib/api/types";
import { screenshotColumns } from "@/utils/grid";

/**
 * 宽高比的允许区间。
 *
 * 极窄的竖图（手机截图）或极宽的横幅如果严格按原始比例，
 * 在列表里会变成一条细缝或一堵墙，都得靠 `cover` 裁回来。
 * 夹到 1:1 ~ 2.2:1 之后，各种图放在一起高度统一得多。
 */
const MIN_RATIO = 1;
const MAX_RATIO = 2.2;
const DEFAULT_RATIO = 1.6;

/** 与页面左右内边距一致（`px-4`） */
const EDGE = 16;
/** 列间距：单列时宽一点，多列时收窄 */
const GAP_SINGLE = 12;
const GAP_GRID = 8;

export function VnScreenshotsTab({ vn }: { vn: VnDetail }): JSX.Element {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const shots = useMemo(() => vn.screenshots ?? [], [vn.screenshots]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // 查看器里的顺序与列表一致，所以直接用下标当索引
  // 查看器用高清 url + dims（缩放边界要靠尺寸算），缩略图只当占位。
  // 引用必须稳定（useMemo）—— ImageViewer 的 data 引用一变就重建条目
  const viewerImages = useMemo<ViewerImage[]>(
    () =>
      shots.map((shot, i) => ({
        url: shot.url,
        thumbnail: shot.thumbnail,
        dims: shot.dims as [number, number] | undefined,
        sexual: shot.sexual,
        violence: shot.violence,
        label: t("vn.screenshotLabel", { index: i + 1 }),
      })),
    [shots, t]
  );

  if (shots.length === 0) {
    return (
      <EmptyState
        title={t("vn.screenshotsEmptyTitle")}
        description={t("vn.screenshotsEmptyDescription")}
      />
    );
  }

  const columns = screenshotColumns(width, height);
  const gap = columns === 1 ? GAP_SINGLE : GAP_GRID;
  // 与封面网格同一个算法：外层 padding 各让半个列间距，格子再让一个列间距
  const cellWidth = (width - (EDGE - gap / 2) * 2) / columns;
  const tileWidth = Math.floor(cellWidth - gap);

  return (
    <View className="flex-1">
      <View style={{ flex: 1, paddingHorizontal: EDGE - gap / 2 }}>
        <FlashList
          /* flex-1 不可省：默认按内容撑开会溢到 Tab 栏下面吃掉触摸 */
          style={{ flex: 1 }}
          /* 列数变了要重挂：布局管理器只在挂载时读一次 numColumns */
          key={`screenshots-${columns}`}
          data={shots}
          numColumns={columns}
          keyExtractor={(shot) => shot.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: gap / 2, paddingBottom: gap }}>
              <ScreenshotCard
                width={tileWidth}
                url={item.url}
                thumbnail={item.thumbnail}
                sexual={item.sexual}
                violence={item.violence}
                /* VNDB 的截图尺寸字段叫 `dims`（[宽, 高]），没有 width/height */
                dims={item.dims as [number, number] | undefined}
                onPress={() => setViewerIndex(index)}
              />
            </View>
          )}
        />
      </View>

      <ImageViewer images={viewerImages} index={viewerIndex} onClose={() => setViewerIndex(null)} />
    </View>
  );
}

function ScreenshotCard({
  width,
  url,
  thumbnail,
  sexual,
  violence,
  dims,
  onPress,
}: {
  /** 格子宽度（像素），由列数算出 */
  width: number;
  url: string;
  thumbnail?: string;
  sexual?: number;
  violence?: number;
  dims?: [number, number];
  onPress: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const gate = useImageGate({ sexual, violence });

  // aspectRatio + 固定宽度让卡片的盒子自己撑开，高度不需要算
  const raw = dims && dims[0] > 0 && dims[1] > 0 ? dims[0] / dims[1] : DEFAULT_RATIO;
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw));

  if (gate.hidden) {
    return (
      <View
        className="items-center justify-center overflow-hidden rounded-lg bg-default-soft"
        style={{ aspectRatio: ratio, width }}
      >
        <Muted type="body-xs">{t("common.hiddenAdult")}</Muted>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-lg bg-default-soft active:opacity-80"
      style={{ aspectRatio: ratio, width }}
      accessibilityRole="imagebutton"
      accessibilityLabel={t("vn.screenshotHint")}
    >
      <Image
        source={url}
        // 缩略图（136×102，约 8 KB）先铺上，原图解码完再盖上去
        placeholder={thumbnail ? { uri: thumbnail } : undefined}
        placeholderContentFit="cover"
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        // 列表滚回去直接命中内存缓存，不再重新解码原图
        cachePolicy="memory-disk"
        blurRadius={gate.blurred ? 18 : 0}
        transition={200}
        // 内容优先（原生没有 lazy/eager，只有优先级队列）
        priority="normal"
        loading="eager"
        recyclingKey={url}
        accessibilityIgnoresInvertColors
      />
      {gate.blurred ? (
        <View className="absolute bottom-1.5 right-2 rounded-full bg-background/80 px-2 py-0.5">
          <Muted type="body-xs" className="text-[10px]">
            {t("common.blurred")}
          </Muted>
        </View>
      ) : null}
    </Pressable>
  );
}
