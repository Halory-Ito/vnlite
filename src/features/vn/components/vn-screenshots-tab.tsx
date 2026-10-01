/**
 * VN 详情 · 截图页签。
 *
 * 拆成独立页签的原因：截图是**列表型内容**，一屏能放好几张，
 * 塞在概览里只能横向滚一条窄带，而且会把概览拉到很长。
 *
 * 独立页签后改成**纵向列表**，用整屏宽度展示，并按原始宽高比（`dims`）出图。
 * 点任意一张进全屏查看器（左右滑切换、双指缩放）。
 */

import { Image } from "expo-image";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer";
import { EmptyState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { useImageGate } from "@/hooks/use-preferences";
import type { VnDetail } from "@/lib/api/types";

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

export function VnScreenshotsTab({ vn }: { vn: VnDetail }): JSX.Element {
  const shots = vn.screenshots ?? [];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (shots.length === 0) {
    return <EmptyState title="没有截图" description="该作品没有上传截图" />;
  }

  // 查看器里的顺序与列表一致，所以直接用下标当索引
  // 查看器用高清 url + dims（缩放边界要靠尺寸算），缩略图只当占位
  const viewerImages: ViewerImage[] = shots.map((shot, i) => ({
    url: shot.url,
    thumbnail: shot.thumbnail,
    dims: shot.dims as [number, number] | undefined,
    sexual: shot.sexual,
    violence: shot.violence,
    label: `截图 ${i + 1}`,
  }));

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-2">
          <View style={{ gap: 12 }}>
            {shots.map((shot, i) => (
              <ScreenshotCard
                key={shot.id}
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
  url,
  thumbnail,
  sexual,
  violence,
  dims,
  onPress,
}: {
  url: string;
  thumbnail?: string;
  sexual?: number;
  violence?: number;
  dims?: [number, number];
  onPress: () => void;
}): JSX.Element {
  const gate = useImageGate({ sexual, violence });

  // aspectRatio + width:100% 让卡片的盒子自己撑开，不需要算像素
  const raw = dims && dims[0] > 0 && dims[1] > 0 ? dims[0] / dims[1] : DEFAULT_RATIO;
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw));

  if (gate.hidden) {
    return (
      <View
        className="items-center justify-center overflow-hidden rounded-lg bg-default-soft"
        style={{ aspectRatio: ratio, width: "100%" }}
      >
        <Muted type="body-xs">已隐藏（成人内容）</Muted>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-lg bg-default-soft active:opacity-80"
      style={{ aspectRatio: ratio, width: "100%" }}
      accessibilityRole="imagebutton"
      accessibilityLabel="作品截图，点击全屏查看"
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
            已模糊
          </Muted>
        </View>
      ) : null}
    </Pressable>
  );
}
