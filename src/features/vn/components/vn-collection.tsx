/**
 * 作品集合：网格（纯封面墙）/ 列表（带元信息的行）两种视图。
 *
 * 给「按制作者 / 按标签」这类作品列表用（清单 Tab 有自己的版本 ——
 * 行上要显示我的打分与状态标签）。网格走共用的 `VnCoverGrid`；
 * 列表复用 `VnListItem`，封面点开查看器、整行点进详情页（和浏览页的列表一致）。
 */

import { FlashList } from "@shopify/flash-list";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer";
import { Separator } from "@/components/separator";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import type { VnViewMode } from "@/lib/storage/preferences";

import { VnCoverGrid } from "./vn-cover-grid";
import { VnListItem } from "./vn-list-item";

export interface VnCollectionProps {
  mode: VnViewMode;
  items: VnSummary[];
  onPressItem: (id: string) => void;
  /** 追加在列表尾部（加载更多提示等） */
  footer?: JSX.Element | null;
}

export function VnCollection({ mode, items, onPressItem, footer }: VnCollectionProps): JSX.Element {
  const { t } = useTranslation();
  // 封面查看器：null = 关着（整段列表共用一个 Modal）
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // 可放大的封面（没图的条目本来就没得看），顺便记下 id → 下标
  const { covers, coverIndex } = useMemo(() => {
    const images: ViewerImage[] = [];
    const index = new Map<string, number>();
    for (const vn of items) {
      const url = vn.image?.url;
      if (!url) continue;
      index.set(vn.id, images.length);
      images.push({
        url,
        thumbnail: vn.image?.thumbnail,
        dims: vn.image?.dims,
        sexual: vn.image?.sexual,
        violence: vn.image?.violence,
        label: t("home.coverLabel", { title: vn.title }),
      });
    }
    return { covers: images, coverIndex: index };
  }, [items, t]);

  if (mode === "grid") {
    return (
      <VnCoverGrid
        entries={items.map((vn) => ({ id: vn.id, title: vn.title, image: vn.image }))}
        onPressItem={onPressItem}
        footer={footer}
      />
    );
  }

  return (
    <View className="flex-1">
      <FlashList<VnSummary>
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(vn) => vn.id}
        renderItem={({ item }) => (
          <View>
            <VnListItem
              vn={item}
              onPress={onPressItem}
              onCoverPress={() => setViewerIndex(coverIndex.get(item.id) ?? null)}
            />
            <Separator />
          </View>
        )}
        ListFooterComponent={
          footer ?? (
            <View className="items-center py-6">
              <Muted type="body-xs">{t("vn.totalCount", { count: items.length })}</Muted>
            </View>
          )
        }
      />

      <ImageViewer
        images={covers}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onIndexChange={setViewerIndex}
      />
    </View>
  );
}
