/**
 * 历史记录行。
 *
 * 布局：封面 / 头像 + 标题 + 副标题 + 浏览时间；点进详情页，长按删除单条。
 * 没有图片的条目（厂商 / 用户）用主题色时钟图标兜底。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Icon } from "@/components/icon";
import { Muted, Paragraph } from "@/components/typo";
import type { HistoryEntry } from "@/lib/db/dao/history";
import { formatRelativeTime } from "@/utils/format";

import { HISTORY_TYPE_ROUTE } from "../history-constants";

export interface HistoryItemProps {
  entry: HistoryEntry;
  onRemove: (entry: HistoryEntry) => void;
}

export function HistoryItem({ entry, onRemove }: HistoryItemProps): JSX.Element {
  const router = useRouter();
  const muted = useThemeColor("muted");

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: HISTORY_TYPE_ROUTE[entry.type],
          params: { id: entry.entryId },
        })
      }
      onLongPress={() => onRemove(entry)}
      delayLongPress={500}
      className="flex-row items-center gap-3 px-4 py-2.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      accessibilityHint="长按删除"
    >
      {entry.imageUrl ? (
        <CoverImage
          url={entry.imageUrl}
          width={48}
          height={[48, 64]}
          roundedClassName="rounded-md"
          priority="low"
        />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-md bg-default-soft">
          <Icon name="clock" size={20} color={muted} />
        </View>
      )}

      <View className="flex-1 justify-center gap-0.5">
        <Paragraph className="line-clamp-1 font-medium" selectable={false}>
          {entry.title}
        </Paragraph>
        {/* 原名与显示名相同时不重复占一行 */}
        {entry.subtitle && entry.subtitle !== entry.title ? (
          <Muted type="body-xs" className="line-clamp-1">
            {entry.subtitle}
          </Muted>
        ) : null}
      </View>

      <Muted type="body-xs" className="text-[10px] opacity-60">
        {formatRelativeTime(entry.viewedAt) ?? ""}
      </Muted>
    </Pressable>
  );
}
