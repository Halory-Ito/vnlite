/**
 * 题材榜：在题材列表里挑一组（可多选，题材之间「全都命中」）按评分排。
 *
 * - 已选题材行：开头是「选择题材」按钮（带已选数量），后面是已选的 chip，
 *   点一下即取消 —— 名次列表旁边一眼看清选了哪些
 * - 「选择题材」打开全屏面板（`tag-panel.tsx`）：搜新题材加入、编辑删除、勾选
 * - 题材列表本身可自定义（`lib/tag-pool.ts` 持久化增删）；
 *   没动过选择时默认选列表里作品数最多的那一个
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useCustomTags } from "@/hooks/use-custom-tags";
import { useTranslation } from "@/hooks/use-translation";
import { useTagRanking } from "@/features/ranking/hooks";
import { FilterChip } from "@/features/browse/components/filter-group";
import { addPoolTags, removePoolTags, type TagLite } from "@/features/ranking/lib/tag-pool";

import { RankingList } from "./ranking-list";
import { TagPanel } from "./tag-panel";

/** 还没动过时的默认选择：列表里第一个（基础候选按作品数排最前） */
function defaultSelection(pool: readonly TagLite[]): readonly string[] {
  return pool[0] ? [pool[0].id] : [];
}

export function TagRanking(): JSX.Element {
  const { t } = useTranslation();
  const { pool, baseIds, poolLoading } = useCustomTags();

  /** `null` = 用户没动过：先默认选一个，一旦动过就完全交给用户 */
  const [picked, setPicked] = useState<readonly string[] | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const selected = picked ?? defaultSelection(pool);
  const query = useTagRanking(selected);

  /** 勾选 / 取消一个题材 */
  const toggleTag = (id: string): void => {
    setPicked((prev) => {
      const current = prev ?? defaultSelection(pool);
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  /** 把搜到的题材加进列表并顺手选中 */
  const addTags = (newTags: readonly TagLite[]): void => {
    void addPoolTags(newTags);
    setPicked((prev) => {
      const current = prev ?? defaultSelection(pool);
      return [...current, ...newTags.map((tag) => tag.id).filter((id) => !current.includes(id))];
    });
  };

  /** 从列表删题材（基础候选记进屏蔽名单）并移出选中 */
  const removeTags = (ids: readonly string[]): void => {
    void removePoolTags(ids, baseIds);
    const gone = new Set(ids);
    setPicked((prev) => (prev ?? defaultSelection(pool)).filter((id) => !gone.has(id)));
  };

  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 2,
          /** Yoga 默认 stretch：行里只有一个子元素时会被拉满整行高 */
          alignItems: "center",
        }}
        className="pb-2"
        /**
         * RN 给横向 ScrollView 内置了 `baseHorizontal: { flexGrow: 1 }`，
         * 在 flex-1 列容器里它会疯长去抢下面的列表空间（没选题材时行高能占大半屏）。
         * 这里按内容高排布，行高只由子元素决定。
         */
        style={{ flexGrow: 0 }}
      >
        <Pressable
          onPress={() => setPanelOpen(true)}
          className="rounded-full border border-border bg-default-soft px-3 py-1.5 active:opacity-70"
          style={{ height: 32, alignItems: "center", justifyContent: "center" }}
          accessibilityRole="button"
          accessibilityLabel={t("ranking.pickTag")}
        >
          <Typography type="body-xs" className="text-accent">
            {selected.length > 0
              ? t("ranking.pickTagCount", { count: selected.length })
              : t("ranking.pickTag")}
          </Typography>
        </Pressable>
        {pool
          .filter((tag) => selected.includes(tag.id))
          .map((tag) => (
            <FilterChip
              key={tag.id}
              option={{ value: tag.id, label: tag.name }}
              active
              onPress={() => toggleTag(tag.id)}
            />
          ))}
      </ScrollView>

      <RankingList
        items={query.data?.results ?? []}
        isLoading={poolLoading || query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
      />

      <TagPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        pool={pool}
        selected={selected}
        onToggle={toggleTag}
        onRemove={removeTags}
        onAddTags={addTags}
      />
    </View>
  );
}
