/**
 * 筛选分组 + 选项胶囊。
 *
 * ## 为什么要重写
 *
 * 原来的 `components/ChipGroup.tsx` 有几个问题，正是「样式混乱」的来源：
 *   1. 多选组和单选组是两份几乎一样的实现，chip 样式复制了两遍
 *   2. 组标题用 `Muted`，和组内 chip 的视觉层级拉不开
 *   3. 「还有 N 项…」是个纯文本，点不了也看不出是哪几项
 *   4. 选中态是 `bg-accent` 实心 + `text-accent-foreground`，未选中是透明，
 *      两种状态在有背景图的情况下对比度差异过大
 *
 * 这里统一成一个 `FilterGroup` + `FilterChip`，选中态用 `accent-soft`
 * （淡色底 + accent 文字），既保留可读性又不像实心块那么抢眼。
 */

import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

export interface FilterChipOption {
  value: string;
  label: string;
}

export interface FilterChipProps {
  option: FilterChipOption;
  active: boolean;
  onPress: () => void;
}

/** 选项胶囊。选中态 = 淡色底 + accent 文字，未选中 = 描边 + 次要文字 */
export function FilterChip({ option, active, onPress }: FilterChipProps): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 active:opacity-70 ${
        active ? "border-accent bg-accent-soft" : "border-border bg-default-soft"
      }`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={option.label}
    >
      <Typography type="body-xs" className={active ? "font-semibold text-accent" : "text-muted"}>
        {option.label}
      </Typography>
    </Pressable>
  );
}

export interface FilterGroupProps {
  label: string;
  /** 已选中数量，>0 时在标题右侧显示，让用户一眼看出哪几组生效了 */
  activeCount?: number;
  children: ReactNode;
}

/**
 * 分组容器。
 *
 * 标题固定用 `foreground` + 半粗 —— 次要色在背景图上太容易糊，
 * 分组标题是扫读时的锚点，必须足够清楚。
 */
export function FilterGroup({ label, activeCount = 0, children }: FilterGroupProps): JSX.Element {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Typography type="body-sm" className="font-semibold">
          {label}
        </Typography>
        {activeCount > 0 ? <ActiveBadge count={activeCount} /> : null}
      </View>
      <View className="flex-row flex-wrap gap-1.5">{children}</View>
    </View>
  );
}

function ActiveBadge({ count }: { count: number }): JSX.Element {
  return (
    <View className="rounded-full bg-accent px-1.5 py-0.5">
      <Typography type="body-xs" className="text-[10px] font-semibold text-accent-foreground">
        {count}
      </Typography>
    </View>
  );
}

export interface MultiSelectGroupProps {
  label: string;
  options: FilterChipOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** 超过这个数量就折叠，只留前 N 个 + 「更多」按钮 */
  collapseAfter?: number;
}

/**
 * 多选组。
 *
 * `collapseAfter` 替代了原来那个点不动的「还有 N 项…」：
 * 超出的选项收进一个可展开的区域，展开状态是本组件内部状态，
 * 不需要调用方参与。
 */
export function MultiSelectGroup({
  label,
  options,
  selected,
  onToggle,
  collapseAfter = 8,
}: MultiSelectGroupProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const collapsible = options.length > collapseAfter;
  const visible = collapsible && !expanded ? options.slice(0, collapseAfter) : options;
  const hidden = options.length - visible.length;

  // 已选项如果被折叠藏起来了，展开一下，避免「明明选了却看不见」
  const hiddenSelected =
    collapsible &&
    !expanded &&
    hidden > 0 &&
    options.slice(collapseAfter).some((o) => selected.includes(o.value));

  return (
    <FilterGroup label={label} activeCount={selected.length}>
      {visible.map((option) => (
        <FilterChip
          key={option.value}
          option={option}
          active={selected.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
      {hidden > 0 ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          className="rounded-full border border-border px-3 py-1.5 active:opacity-70"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Typography type="body-xs" className="text-accent">
            {expanded ? "收起" : `更多 ${hidden} 项`}
          </Typography>
        </Pressable>
      ) : null}
      {hiddenSelected ? (
        <Typography type="body-xs" className="text-warning-soft-foreground">
          有已选项被折叠了，展开才能看到
        </Typography>
      ) : null}
    </FilterGroup>
  );
}

/** 单选组（评分、开发状态这类） */
export interface SingleSelectGroupProps {
  label: string;
  options: FilterChipOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export function SingleSelectGroup({
  label,
  options,
  selected,
  onSelect,
}: SingleSelectGroupProps): JSX.Element {
  return (
    <FilterGroup label={label} activeCount={selected ? 1 : 0}>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          option={option}
          active={selected === option.value}
          // 再次点击已选项 = 取消，走 onSelect(null)
          onPress={() => onSelect(selected === option.value ? null : option.value)}
        />
      ))}
    </FilterGroup>
  );
}
