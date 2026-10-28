/**
 * 作品封面墙（手机 3 列 / 平板 6 或 8 列）。
 *
 * 清单 Tab 与制作者详情的「作品」页签共用；条目只画封面（点格子 = 进作品详情页），
 * 敏感封面的「双击放行」仍由 `CoverImage` 处理。
 *
 * 列数由 `utils/grid#coverGridColumns` 决定（手机 3 / iPad mini 6 / 大平板 8）；
 * 宽度取**容器实测宽度**（`onLayout`），父级有最大宽度或多栏布局时也能算对。
 * 转屏时短边不变，格子不会跳。列数变化要给 FlashList 换 `key`：
 * 它的布局管理器只在挂载时按 `numColumns` 建一次，原地改值不生效。
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
import { useState } from "react";
import { Pressable, View, useWindowDimensions, type RefreshControlProps } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { imageGate, useNsfwMode } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { Image } from "@/lib/api/types";
import type { NsfwMode } from "@/lib/storage/preferences";
import { coverGridColumns } from "@/utils/grid";

/** 网格布局：列数随屏幕、格子间距 8、左右外边距 16 */
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /**
   * 网格宽度按**容器**量，而不是窗口。
   *
   * 手机上两者一样；平板上详情页以后可能做双栏、或者某个父容器有最大宽度，
   * 那时按窗口算就会多算列、把封面挤扁。`onLayout` 前先用窗口宽度兜底。
   */
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth > 0 ? measuredWidth : windowWidth;
  const nsfwMode = useNsfwMode();
  // 短边决定列数：这里把「容器宽度」和「窗口高度」一起传进去
  const columns = coverGridColumns(width, windowHeight);
  const cellWidth = (width - (EDGE - GAP / 2) * 2) / columns;
  const coverWidth = Math.floor(cellWidth - GAP);

  return (
    <View
      style={{ flex: 1, paddingHorizontal: EDGE - GAP / 2 }}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (Math.abs(next - measuredWidth) > 1) setMeasuredWidth(next);
      }}
    >
      <FlashList<CoverGridEntry>
        /*
         * flex-1 不可省：FlashList 默认按内容高度撑开，会溢出到 Tab 栏下方，
         * 把 Tab 栏的触摸事件全吃掉（浏览页踩过同一个坑）。
         */
        style={{ flex: 1 }}
        /* 列数变了要重挂：布局管理器只在挂载时读一次 numColumns */
        key={`cover-grid-${columns}`}
        data={entries as CoverGridEntry[]}
        numColumns={columns}
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
