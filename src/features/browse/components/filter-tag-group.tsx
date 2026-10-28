/**
 * 筛选面板的「题材」分组：**可多选**（组合之间「都命中」，`compileVnFilters`
 * 的 tag 语义），已选在先，快捷推荐省滑动，「添加」展开搜索补长尾。
 *
 * 推荐的候选就是**排行榜里那份用户自定义题材列表**（`hooks/use-custom-tags`，
 * Master 要求与题材榜一致）：自动候选 ∪ 排行榜加的 − 排行榜删的。
 * 筛选状态只存 id；名字由 `lib/tag-names` 的 id→名字字典显示
 * （选用时顺手记下，KV 持久化跨会话仍在）。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { useCustomTags } from "@/hooks/use-custom-tags";
import { useTranslation } from "@/hooks/use-translation";
import type { VnFilterState } from "@/lib/api/filters";
import type { TagLite } from "@/lib/api/types";

import { loadTagNames, recordTagNames, useTagNames } from "@/features/browse/lib/tag-names";
import { FilterChip } from "./filter-group";
import { TagSearch } from "./tag-search";

/** 快捷推荐个数（自定义列表前 12；更多走「添加题材」搜索） */
const POPULAR_TAG_COUNT = 12;

export interface FilterTagGroupProps {
  filters: VnFilterState;
  /** 筛选状态的部分更新（面板同一份状态） */
  update: (patch: Partial<VnFilterState>) => void;
}

export function FilterTagGroup({ filters, update }: FilterTagGroupProps): JSX.Element {
  const { t } = useTranslation();
  // 与排行榜题材列表同一份（自动候选 ∪ 用户自加 − 用户删除）
  const { pool } = useCustomTags();
  /** id → 名字字典（选用时记录，加载后汇总条不再显示裸 id） */
  const names = useTagNames();
  const [searchOpen, setSearchOpen] = useState(false);

  // 名字字典从 KV 读一次（已读过就直接返回）
  useEffect(() => {
    void loadTagNames();
  }, []);

  /** 已选题材（快捷推荐会把已选的排掉；搜索结果的「已在筛选」判断也用它） */
  const poolIds = useMemo(() => new Set(filters.tags ?? []), [filters.tags]);
  const tags = filters.tags ?? [];

  /** 把题材加入筛选组合（去重），顺带把名字记进字典供汇总条显示 */
  const addTags = (newTags: readonly TagLite[]): void => {
    void recordTagNames(newTags);
    const fresh = newTags.map((tag) => tag.id).filter((id) => !poolIds.has(id));
    if (fresh.length > 0) update({ tags: [...tags, ...fresh] });
  };

  /** 取消一个题材 */
  const removeTag = (id: string): void => {
    update({ tags: tags.filter((x) => x !== id) });
  };

  return (
    <View className="gap-2">
      <Typography type="body-sm" className="font-semibold">
        {t("browse.filter.tags")}
      </Typography>
      <View className="flex-row flex-wrap items-start gap-1.5">
        {tags.map((id) => (
          <FilterChip
            key={id}
            option={{ value: id, label: `#${names[id] ?? id}` }}
            active
            onPress={() => removeTag(id)}
          />
        ))}
        {pool
          .filter((tag) => !poolIds.has(tag.id))
          .slice(0, POPULAR_TAG_COUNT)
          .map((tag) => (
            <FilterChip
              key={tag.id}
              option={{ value: tag.id, label: tag.name }}
              active={false}
              onPress={() => addTags([tag])}
            />
          ))}
        <FilterChip
          option={{ value: "add", label: t("browse.filter.addTag") }}
          active={searchOpen}
          onPress={() => setSearchOpen((prev) => !prev)}
        />
      </View>
      {searchOpen ? <TagSearch poolIds={poolIds} onAddTags={addTags} /> : null}
    </View>
  );
}
