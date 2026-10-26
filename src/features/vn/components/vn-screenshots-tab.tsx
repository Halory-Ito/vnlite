/**
 * VN 详情 · 截图页签。
 *
 * 拆成独立页签的原因：截图是**列表型内容**，一屏能放好几张，
 * 塞在概览里只能横向滚一条窄带，而且会把概览拉到很长。
 *
 * 布局按屏幕分档（`utils/grid#screenshotColumns`）：手机单列大图，
 * iPad mini 3 列、大平板 4 列 —— 平板上单列会浪费掉大半屏宽度。
 * 每张图仍按原始宽高比（`dims`）出图，点任意一张进全屏查看器。
 */

import { Image } from "expo-image";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

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
  const shots = vn.screenshots ?? [];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (shots.length === 0) {
    return (
      <EmptyState
        title={t("vn.screenshotsEmptyTitle")}
        description={t("vn.screenshotsEmptyDescription")}
      />
    );
  }

  // 查看器里的顺序与列表一致，所以直接用下标当索引
  // 查看器用高清 url + dims（缩放边界要靠尺寸算），缩略图只当占位
  const viewerImages: ViewerImage[] = shots.map((shot, i) => ({
    url: shot.url,
    thumbnail: shot.thumbnail,
    dims: shot.dims as [number, number] | undefined,
    sexual: shot.sexual,
    violence: shot.violence,
    label: t("vn.screenshotLabel", { index: i + 1 }),
  }));

  const columns = screenshotColumns(width, height);
  const gap = columns === 1 ? GAP_SINGLE : GAP_GRID;
  // 与封面网格同一个算法：可用宽度减掉列间距后均分
  const tileWidth = Math.floor((width - EDGE * 2 - gap * (columns - 1)) / columns);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row flex-wrap px-4 pt-2" style={{ gap }}>
          {shots.map((shot, i) => (
            <ScreenshotCard
              key={shot.id}
              width={tileWidth}
              url={shot.url}
              thumbnail={shot.thumbnail}
              sexual={shot.sexual}
              violence={shot.violence}
              /* VNDB 的截图尺寸字段叫 `dims`（[宽, 高]），没有 width/height */
              dims={shot.dims as [number, number] | undefined}
              onPress={() => setViewerIndex(i)}
            />
          ))}
        </View>
      </ScrollView>

      <ImageViewer
        images={viewerImages}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
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
        // 缩略图（136×102，几 KB）先铺上，高清图解码完再盖上去
        placeholder={thumbnail ? { uri: thumbnail } : undefined}
        placeholderContentFit="cover"
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
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
