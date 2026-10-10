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
} from "@/features/browse/components/filter-group";
import { FullScreenPanel } from "@/features/browse/components/panel";
import { useTranslation } from "@/hooks/use-translation";

import { VOTE_COLUMNS, toggleVoteColumn, type VoteColumn } from "../vote-columns";

export function VoteColumnsPanel({
  visible,
  onChange,
  onClose,
}: {
  visible: readonly VoteColumn[];
  onChange: (next: VoteColumn[]) => void;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const options: FilterChipOption[] = VOTE_COLUMNS.map((column) => ({
    value: column.key,
    label: t(column.labelKey),
  }));

  return (
    <FullScreenPanel
      title={t("user.columnsPanelTitle")}
      accessibilityLabel={t("user.columnsPanelTitle")}
      onClose={onClose}
    >
      <FilterGroup label={t("user.columnsGroup")} activeCount={visible.length}>
        {options.map((option) => (
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
