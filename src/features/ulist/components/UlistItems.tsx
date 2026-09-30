/**
 * 清单条目集合：网格（纯封面墙）与列表（行）两种视图。
 *
 * 两种视图共用同一套分页、下拉刷新与触底加载；只有 `renderItem` 不同。
 * 网格用 `numColumns={3}`，格子按 VNDB 缩略图的原生比例 256×362 铺封面；
 * 点格子与点列表行行为一致 —— 进清单编辑页。
 */

import { FlashList } from "@shopify/flash-list";
import type { JSX } from "react";
import { Pressable, RefreshControl, View, useWindowDimensions } from "react-native";

import { CoverImage } from "@/components/CoverImage";
import { Separator } from "@/components/Separator";
import { Muted } from "@/components/Typo";
import { imageGate, useNsfwMode } from "@/hooks/usePreferences";
import type { UListItem } from "@/lib/api/types";
import type { NsfwMode, UlistViewMode } from "@/lib/storage/preferences";

import { UlistItemRow } from "./UlistItemRow";

/** 网格：3 列，格子间距 8，左右外边距 16（两边各减半个间距给 FlashList 分列） */
const COLUMNS = 3;
const GAP = 8;
const EDGE = 16;
/** VNDB 封面缩略图的原生比例（256×362） */
const COVER_RATIO = [256, 362] as const;

export interface UlistItemsProps {
  mode: UlistViewMode;
  items: UListItem[];
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  /** 点条目：进清单编辑页（`/ulist/{已加入的 VN id}`） */
  onPressItem: (vnId: string) => void;
}

export function UlistItems({
  mode,
  items,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
}: UlistItemsProps): JSX.Element {
  const { width } = useWindowDimensions();
  // 一个 NSFW 订阅供整屏格子共用（格子里判断「这张封面会不会被隐藏」）
  const nsfwMode = useNsfwMode();
  // 与 FlashList 的分列算法一致：可用宽度 = 屏宽 − 两侧外边距，再均分给 3 列。
  // 封面比格子窄一个间距，多出来的部分由格子的 padding 消化（就是列间距）
  const cellWidth = (width - (EDGE - GAP / 2) * 2) / COLUMNS;
  const coverWidth = Math.floor(cellWidth - GAP);

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;
  const footer = isFetchingNextPage ? (
    <Muted type="body-xs" className="py-4 text-center">
      加载更多…
    </Muted>
  ) : null;

  if (mode === "grid") {
    /*
     * ⚠️ FlashList v2 的布局管理器按**列表自身宽度**分列（windowSize / numColumns），
     * 不认 `contentContainerStyle` 的 padding（内容容器 padding 会把整行推出去被裁掉）。
     * 所以左右外边距用外层 View 的 padding，列间距用格子的 padding —— 换来的
     * 可用宽度与下面的 `cellWidth` 计算完全一致。
     */
    return (
      <View style={{ flex: 1, paddingHorizontal: EDGE - GAP / 2 }}>
        <FlashList<UListItem>
          /*
           * flex-1 不可省：FlashList 默认按内容高度撑开，会溢出到 Tab 栏下方，
           * 把 Tab 栏的触摸事件全吃掉（浏览页踩过同一个坑）。
           */
          style={{ flex: 1 }}
          data={items}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GridTile item={item} width={coverWidth} nsfwMode={nsfwMode} onPress={onPressItem} />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          refreshControl={refreshControl}
          ListFooterComponent={footer}
        />
      </View>
    );
  }

  return (
    <FlashList<UListItem>
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <UlistItemRow item={item} onPress={onPressItem} />}
      ItemSeparatorComponent={Separator}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={refreshControl}
      ListFooterComponent={footer}
    />
  );
}

/** 网格格子：只有封面。敏感封面的「双击放行」仍由 `CoverImage` 处理 */
function GridTile({
  item,
  width,
  nsfwMode,
  onPress,
}: {
  item: UListItem;
  width: number;
  nsfwMode: NsfwMode;
  onPress: (vnId: string) => void;
}): JSX.Element {
  const image = item.vn?.image;
  const title = item.vn?.title ?? item.id;
  const cover = (
    <CoverImage
      url={image?.thumbnail ?? image?.url}
      width={width}
      height={COVER_RATIO}
      sexual={image?.sexual}
      violence={image?.violence}
      accessibilityLabel={`${title} 封面`}
      onPress={() => onPress(item.id)}
    />
  );

  return (
    // padding = 列间距（左右各一半）+ 行间距（下），封面在格子里居中吸收取整误差
    <View style={{ paddingHorizontal: GAP / 2, paddingBottom: GAP, alignItems: "center" }}>
      {imageGate(nsfwMode, { sexual: image?.sexual, violence: image?.violence }).hidden ? (
        // 「隐藏」档下 CoverImage 只画占位、没有自己的 Pressable，
        // 这里补一层可点区域 —— 否则这些条目在网格里完全打不开
        <Pressable
          onPress={() => onPress(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${title} 封面（已按内容偏好隐藏）`}
        >
          {cover}
        </Pressable>
      ) : (
        cover
      )}
    </View>
  );
}
