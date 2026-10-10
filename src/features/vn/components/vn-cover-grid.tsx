/**
 * 作品封面墙（3 列网格）。
 *
 * 清单 Tab 与制作者详情的「作品」页签共用；条目只画封面（点格子 = 进作品详情页），
 * 敏感封面的「双击放行」仍由 `CoverImage` 处理。
 *
 * ⚠️ FlashList v2 的布局管理器按**列表自身宽度**分列（windowSize / numColumns），
 * 不认 `contentContainerStyle` 的 padding（内容容器 padding 会把整行推出去被裁掉）。
 * 所以左右外边距用外层 View 的 padding，列间距用格子的 padding ——
 * 两处加起来的可用宽度与下面的 `coverWidth` 计算一致。
 *
 * ⚠️ `NSFW = hide` 档下 `CoverImage` 只画占位、没有自己的 Pressable，
 * 格子会补一层可点区域 —— 否则这些条目在网格里完全打不开。
 */

import { FlashList } from "@shopify/flash-list";
import type { JSX, ReactElement } from "react";
import { Pressable, View, useWindowDimensions, type RefreshControlProps } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { imageGate, useNsfwMode } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { Image } from "@/lib/api/types";
import type { NsfwMode } from "@/lib/storage/preferences";

/** 网格布局：3 列，格子间距 8，左右外边距 16 */
const COLUMNS = 3;
const GAP = 8;
const EDGE = 16;
/** VNDB 封面缩略图的原生比例（256×362） */
const COVER_RATIO = [256, 362] as const;

/** 网格条目：只取画封面需要的字段 */
export interface CoverGridEntry {
  id: string;
  title: string;
  image?: Image;
}

export interface VnCoverGridProps {
  entries: readonly CoverGridEntry[];
  onPressItem: (id: string) => void;
  /** 触底加载（可省） */
  onEndReached?: () => void;
  /** 下拉刷新（可省） */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** 列表尾部（加载更多提示等） */
  footer?: ReactElement | null;
}

export function VnCoverGrid({
  entries,
  onPressItem,
  onEndReached,
  refreshControl,
  footer,
}: VnCoverGridProps): JSX.Element {
  const { width } = useWindowDimensions();
  // 一个 NSFW 订阅供整屏格子共用（格子里判断「这张封面会不会被隐藏」）
  const nsfwMode = useNsfwMode();
  const cellWidth = (width - (EDGE - GAP / 2) * 2) / COLUMNS;
  const coverWidth = Math.floor(cellWidth - GAP);

  return (
    <View style={{ flex: 1, paddingHorizontal: EDGE - GAP / 2 }}>
      <FlashList<CoverGridEntry>
        /*
         * flex-1 不可省：FlashList 默认按内容高度撑开，会溢出到 Tab 栏下方，
         * 把 Tab 栏的触摸事件全吃掉（浏览页踩过同一个坑）。
         */
        style={{ flex: 1 }}
        data={entries as CoverGridEntry[]}
        numColumns={COLUMNS}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (
          <GridTile entry={item} width={coverWidth} nsfwMode={nsfwMode} onPress={onPressItem} />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        refreshControl={refreshControl}
        ListFooterComponent={footer}
      />
    </View>
  );
}

/** 网格格子：只有封面 */
function GridTile({
  entry,
  width,
  nsfwMode,
  onPress,
}: {
  entry: CoverGridEntry;
  width: number;
  nsfwMode: NsfwMode;
  onPress: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const image = entry.image;
  const cover = (
    <CoverImage
      url={image?.thumbnail ?? image?.url}
      width={width}
      height={COVER_RATIO}
      sexual={image?.sexual}
      violence={image?.violence}
      accessibilityLabel={t("home.coverLabel", { title: entry.title })}
      onPress={() => onPress(entry.id)}
    />
  );

  return (
    // padding = 列间距（左右各一半）+ 行间距（下），封面在格子里居中吸收取整误差
    <View style={{ paddingHorizontal: GAP / 2, paddingBottom: GAP, alignItems: "center" }}>
      {imageGate(nsfwMode, { sexual: image?.sexual, violence: image?.violence }).hidden ? (
        <Pressable
          onPress={() => onPress(entry.id)}
          accessibilityRole="button"
          accessibilityLabel={t("home.coverHiddenLabel", { title: entry.title })}
        >
          {cover}
        </Pressable>
      ) : (
        cover
      )}
    </View>
  );
}
