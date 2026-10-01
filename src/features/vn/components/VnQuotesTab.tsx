/**
 * VN 详情 · 语录页签。
 *
 * 数据来自 `/quote` 的 `vn` 嵌套过滤器（`queryQuotes({ vnId })`），按 `score` 降序 ——
 * 和最热门的排前面，和 VNDB 网站上「Quotes」区块的默认顺序一致。
 *
 * 只取前 50 条：热门作品动辄几百条语录，一次拉满既慢又没人翻到底。
 */

import { Link } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/Icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { Muted, Paragraph } from "@/components/Typo";
import type { Quote } from "@/lib/api/types";

import { useVnQuotes } from "../hooks";

export function VnQuotesTab({ vnId }: { vnId: string }): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useVnQuotes(vnId);

  if (isLoading) return <LoadingState label="加载语录…" className="py-12" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.length === 0) return <EmptyState title="该作品没有登记语录" />;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <Muted type="body-xs" className="px-4 pt-3 pb-1">
        按评分排序，共 {data.length} 条
      </Muted>
      {data.map((quote) => (
        <QuoteRow key={quote.id} quote={quote} />
      ))}
    </ScrollView>
  );
}

function QuoteRow({ quote }: { quote: Quote }): JSX.Element {
  // 图标只能吃具体色值（不吃 className），所以走主题 accent
  const accent = useThemeColor("accent");
  const character = quote.character;

  return (
    <View className="mx-4 mt-2 gap-2 rounded-lg bg-default-soft p-3">
      <Paragraph>「{quote.quote}」</Paragraph>

      <View className="flex-row items-center justify-between gap-3">
        {character ? (
          <Link href={`/character/${character.id}`} asChild>
            <Pressable className="shrink active:opacity-60" accessibilityRole="link">
              <Muted type="body-xs" className="text-link" numberOfLines={1}>
                {character.name}
              </Muted>
            </Pressable>
          </Link>
        ) : (
          <View />
        )}

        {quote.score != null ? (
          <View className="flex-row items-center gap-1">
            <Icon name="star" size={12} color={accent} />
            <Muted type="body-xs" className="font-semibold">
              {quote.score}
            </Muted>
          </View>
        ) : null}
      </View>
    </View>
  );
}
