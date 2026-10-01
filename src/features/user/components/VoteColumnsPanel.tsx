/**
 * 「显示哪些列」筛选面板。
 *
 * 复用浏览页的 `FullScreenPanel` + `FilterGroup` / `FilterChip`：
 * 面板外壳、全屏覆盖层的坑（关闭后残留触摸）都已经在那儿踩平了，
 * 这里只换内容 —— 与「卡片显示」面板是同一类东西：筛的不是数据，是外观。
 */

import type { JSX } from "react";

import {
  FilterChip,
  FilterGroup,
  type FilterChipOption,
} from "@/features/browse/components/FilterGroup";
import { FullScreenPanel } from "@/features/browse/components/Panel";

import { VOTE_COLUMNS, toggleVoteColumn, type VoteColumn } from "../voteColumns";

const OPTIONS: FilterChipOption[] = VOTE_COLUMNS.map((column) => ({
  value: column.key,
  label: column.label,
}));

export function VoteColumnsPanel({
  visible,
  onChange,
  onClose,
}: {
  visible: readonly VoteColumn[];
  onChange: (next: VoteColumn[]) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <FullScreenPanel title="显示哪些列" accessibilityLabel="显示哪些列" onClose={onClose}>
      <FilterGroup label="列表里显示的信息" activeCount={visible.length}>
        {OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            active={visible.includes(option.value as VoteColumn)}
            onPress={() => onChange(toggleVoteColumn(visible, option.value as VoteColumn))}
          />
        ))}
      </FilterGroup>
    </FullScreenPanel>
  );
}
