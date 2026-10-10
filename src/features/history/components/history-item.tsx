/**
 * 历史记录行。
 *
 * 布局（封面 / 头像 + 标题 + 副标题 + 浏览时间）与收藏行共用 `EntryListItem`，
 * 这里只负责「取路由、长按删除」这两件历史特有的事。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";

import { EntryListItem } from "@/components/entry-list-item";
import { useKungalNameLogo } from "@/features/catalog/use-kungal-logo";
import { useTranslation } from "@/hooks/use-translation";
import type { HistoryEntry } from "@/lib/db/dao/history";
import { formatRelativeTime } from "@/utils/format";

import { HISTORY_TYPE_ROUTE } from "../history-constants";

export interface HistoryItemProps {
  entry: HistoryEntry;
  onRemove: (entry: HistoryEntry) => void;
}

export function HistoryItem({ entry, onRemove }: HistoryItemProps): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  // 厂商条目兜底补 LOGO（老记录没存图片；新记录在详情页已写入）
  const isProducer = entry.type === "producer";
  const fallbackLogo = useKungalNameLogo(
    isProducer ? entry.title : null,
    isProducer ? entry.subtitle : null
  );

  return (
    <EntryListItem
      title={entry.title}
      subtitle={entry.subtitle}
      timestamp={formatRelativeTime(entry.viewedAt)}
      imageUrl={entry.imageUrl ?? fallbackLogo}
      imageIsSafe={isProducer}
      fallbackIcon="clock"
      onPress={() =>
        router.push({
          pathname: HISTORY_TYPE_ROUTE[entry.type],
          params: { id: entry.entryId },
        })
      }
      onLongPress={() => onRemove(entry)}
      accessibilityHint={t("history.longPressRemove")}
    />
  );
}
