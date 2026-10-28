/**
 * 题材搜索选择器：输入防抖 350ms 走 `/tag` 的 `search` 过滤器
 * （`searchrank` 排序，与全局搜索同缓存 key）。
 *
 * 结果一行一个：名字 + 作品数 + 动作；点一下交给 `onAddTags`（做什么由调用方定 ——
 * 排行榜是「加进题材列表并选中」，浏览筛选是「加进筛选组合」）。
 * 已在集合里的行标「已在列表」，再点没有动作 —— 不该有「重复添加」的错觉。
 *
 * 排行榜面板与浏览筛选面板共用；后者是长表单一块，所以 `autoFocus` 不默认开。
 */

import { useQuery } from "@tanstack/react-query";
import { Input, Typography } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Muted, Paragraph } from "@/components/typo";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/hooks/use-translation";
import { queryTags } from "@/lib/api/endpoints/catalog";
import type { TagLite } from "@/lib/api/types";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { formatCount } from "@/utils/format";

export interface TagSearchProps {
  /** 当前已收藏的题材集合（已在集合的结果标状态、不再给「添加」动作） */
  poolIds: ReadonlySet<string>;
  onAddTags: (tags: readonly TagLite[]) => void;
  /** 挂载即弹键盘（排行题材面板用；筛选面板里是长表单，别抢焦点） */
  autoFocus?: boolean;
}

/** 一次拉回的结果数 */
const RESULT_COUNT = 15;

export function TagSearch({ poolIds, onAddTags, autoFocus = false }: TagSearchProps): JSX.Element {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const keyword = useDebouncedValue(input.trim(), 350);

  const search = useQuery({
    queryKey: queryKeys.tag.list(keyword),
    enabled: input.trim().length > 0,
    queryFn: ({ signal }) =>
      queryTags({ search: keyword, sort: "searchrank", results: RESULT_COUNT, signal }),
    staleTime: STALE_TIME.catalog,
  });

  const results = (search.data?.results ?? []).filter(
    (tag, index, list) => Boolean(tag.id) && list.findIndex((x) => x.id === tag.id) === index
  );

  return (
    <View className="gap-2">
      <Input
        value={input}
        onChangeText={setInput}
        placeholder={t("browse.filter.tagPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        autoFocus={autoFocus}
        accessibilityLabel={t("browse.filter.tagPlaceholder")}
      />

      {input.trim().length > 0 ? (
        search.isLoading ? (
          <Muted type="body-xs" className="py-2">
            {t("common.loading")}
          </Muted>
        ) : results.length === 0 ? (
          <Muted type="body-xs" className="py-2">
            {t("browse.filter.tagNoResults")}
          </Muted>
        ) : (
          results.map((tag) => (
            <ResultRow
              key={tag.id}
              tag={tag}
              inPool={poolIds.has(tag.id)}
              onAdd={() => onAddTags([tag])}
            />
          ))
        )
      ) : null}
    </View>
  );
}

/** 一条结果：题材名 + 作品数 + 动作（已在列表 / 添加） */
function ResultRow({
  tag,
  inPool,
  onAdd,
}: {
  tag: TagLite & { vn_count?: number };
  inPool: boolean;
  onAdd: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={inPool ? undefined : onAdd}
      className="w-full flex-row items-center justify-between gap-3 rounded-lg px-3 py-2.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={tag.name}
    >
      <Paragraph numberOfLines={1} className="flex-1">
        {tag.name}
      </Paragraph>
      <Muted type="body-xs">
        {t("browse.filter.tagVnCount", { count: formatCount(tag.vn_count) })}
      </Muted>
      <Typography type="body-xs" className={inPool ? "text-muted" : "text-accent"}>
        {inPool ? t("browse.filter.tagInList") : t("common.add")}
      </Typography>
    </Pressable>
  );
}
