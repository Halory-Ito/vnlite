/**
 * 横向可滚动的封面墙（首页「即将发售」「最新上架」两档用）。
 *
 * 只画**封面 + 名称**（Master 要求），点封面进站内作品详情。
 * 横向 ScrollView 放在首页的竖向 ScrollView 里没问题（两个方向不冲突）。
 *
 * 右侧刻意多露一点（`PEEK`），暗示「还能往右滑」——
 * 比一屏塞满更容易让人知道后面还有内容。
 */

import type { JSX } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Muted } from "@/components/typo";
import { imageGate, useNsfwMode } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import type { NsfwMode } from "@/lib/storage/preferences";

/** VNDB 封面缩略图比例（256×362） */
const COVER_RATIO = [256, 362] as const;
const CARD_WIDTH = 96;
const GAP = 10;
const EDGE = 16;
const PEEK = 28;

export interface VnCoverCarouselProps {
  items: readonly VnSummary[];
  onPressItem: (id: string) => void;
}

export function VnCoverCarousel({ items, onPressItem }: VnCoverCarouselProps): JSX.Element {
  const nsfwMode = useNsfwMode();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="w-full"
      contentContainerStyle={{
        paddingHorizontal: EDGE,
        paddingRight: EDGE + PEEK,
        gap: GAP,
        paddingVertical: 10,
      }}
    >
      {items.map((vn) => (
        <Card key={vn.id} vn={vn} width={CARD_WIDTH} nsfwMode={nsfwMode} onPress={onPressItem} />
      ))}
    </ScrollView>
  );
}

function Card({
  vn,
  width,
  nsfwMode,
  onPress,
}: {
  vn: VnSummary;
  width: number;
  nsfwMode: NsfwMode;
  onPress: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const image = vn.image;
  const cover = (
    <CoverImage
      url={image?.thumbnail ?? image?.url}
      width={width}
      height={COVER_RATIO}
      sexual={image?.sexual}
      violence={image?.violence}
      accessibilityLabel={t("home.coverLabel", { title: vn.title })}
      onPress={() => onPress(vn.id)}
    />
  );

  return (
    <View className="gap-1.5" style={{ width }}>
      {/* NSFW = hide 档下 CoverImage 只画占位、没有自己的 Pressable，得补一层可点区域
          （与 VnCoverGrid 同一个坑） */}
      {imageGate(nsfwMode, { sexual: image?.sexual, violence: image?.violence }).hidden ? (
        <Pressable
          onPress={() => onPress(vn.id)}
          accessibilityRole="button"
          accessibilityLabel={t("home.coverHiddenLabel", { title: vn.title })}
        >
          {cover}
        </Pressable>
      ) : (
        cover
      )}
      <Muted type="body-xs" numberOfLines={2}>
        {vn.title}
      </Muted>
    </View>
  );
}

/** 骨架屏：按屏宽算能放几张，尺寸与真实卡片一致，避免加载完时页面跳一下 */
export function CarouselSkeleton(): JSX.Element {
  const { width } = useWindowDimensions();
  const fit = Math.floor((width - EDGE + PEEK) / (CARD_WIDTH + GAP));
  const count = Math.max(2, Math.min(fit, 4));

  return (
    <View className="flex-row" style={{ paddingHorizontal: EDGE, gap: GAP, paddingVertical: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="gap-1.5" style={{ width: CARD_WIDTH }}>
          <View
            className="rounded-md bg-default-soft"
            style={{ width: CARD_WIDTH, height: Math.round((CARD_WIDTH * 362) / 256) }}
          />
          <View className="h-3 w-4/5 rounded bg-default-soft" />
        </View>
      ))}
    </View>
  );
}
