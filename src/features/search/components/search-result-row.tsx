/**
 * 搜索结果行（staff / 制作者 / 用户 共用）。
 *
 * 作品那一档用 `VnInfiniteList`（要封面查看器），这里的行没有封面，
 * 所以是「名称 + 罗马字原名 + 右侧次要信息 + 箭头」四段式。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Separator } from "@/components/separator";
import { Muted, Paragraph } from "@/components/typo";

import type { SearchEntry } from "../search-logic";

export interface SearchResultRowProps {
  entry: SearchEntry;
  onPress: (id: string) => void;
}

export function SearchResultRow({ entry, onPress }: SearchResultRowProps): JSX.Element {
  // 箭头取主题 muted（写死颜色换主题就对不上了）
  const muted = useThemeColor("muted");

  return (
    <View>
      <Pressable
        onPress={() => onPress(entry.id)}
        className="flex-row items-center gap-3 px-4 py-2.5 active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel={entry.title}
      >
        <View className="flex-1 gap-0.5">
          <Paragraph numberOfLines={1}>{entry.title}</Paragraph>
          {/* 原名与显示名相同时不重复占一行 */}
          {entry.original && entry.original !== entry.title ? (
            <Muted type="body-xs" numberOfLines={1}>
              {entry.original}
            </Muted>
          ) : null}
        </View>
        {entry.meta ? (
          <Muted type="body-xs" className="text-[10px] opacity-70">
            {entry.meta}
          </Muted>
        ) : null}
        <Icon name="chevronRight" size={16} color={muted} />
      </Pressable>
      <Separator />
    </View>
  );
}
