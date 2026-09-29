/**
 * 筛选条件汇总条。
 *
 * 放在面板顶部，只读展示「当前生效了哪些条件」，每条都能单独删掉。
 *
 * ## 为什么需要它
 *
 * 面板里有 10 个分组、几十个选项，光靠往回滚去找哪个被选上了非常痛苦。
 * 汇总条把「已生效条件」压缩成一行可点的标签：
 *   - 改完立刻能看到结果（边改边生效，不点「应用」）
 *   - 想撤销某一条，点标签上的 ✕ 即可，不用回到对应分组
 *   - 顺带承担「清空」入口
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Muted } from "@/components/Muted";
import { LENGTH, LANGUAGE_LABEL, PLATFORM_LABEL, type DevStatus } from "@/lib/api/enums";
import type { VnFilterState } from "@/lib/api/filters";
import { devStatusLabel } from "@/utils/format";

/** 一条生效中的条件。`clear` 返回清掉它之后的新状态 */
export interface ActiveFilter {
  key: string;
  label: string;
  clear: (filters: VnFilterState) => VnFilterState;
}

/**
 * 把筛选状态翻译成可展示、可单独撤销的标签列表。
 *
 * 单独抽出来是因为汇总条和「浏览」页顶部的计数都要用，
 * 两处必须显示完全一致的内容。
 */
export function describeFilters(filters: VnFilterState): ActiveFilter[] {
  const out: ActiveFilter[] = [];

  if (filters.ratingRange) {
    const [min] = filters.ratingRange;
    out.push({
      key: "rating",
      label: `评分 ≥ ${min}`,
      clear: (f) => ({ ...f, ratingRange: undefined }),
    });
  }

  for (const tag of filters.tags ?? []) {
    out.push({
      key: `tag:${tag}`,
      label: `#${tag}`,
      clear: (f) => ({ ...f, tags: without(f.tags, tag) }),
    });
  }

  for (const lang of filters.olang ?? []) {
    out.push({
      key: `olang:${lang}`,
      label: `原语言 ${LANGUAGE_LABEL[lang] ?? lang}`,
      clear: (f) => ({ ...f, olang: without(f.olang, lang) }),
    });
  }

  for (const lang of filters.lang ?? []) {
    out.push({
      key: `lang:${lang}`,
      label: `语言 ${LANGUAGE_LABEL[lang] ?? lang}`,
      clear: (f) => ({ ...f, lang: without(f.lang, lang) }),
    });
  }

  for (const p of filters.platform ?? []) {
    out.push({
      key: `platform:${p}`,
      label: PLATFORM_LABEL[p] ?? p,
      clear: (f) => ({ ...f, platform: without(f.platform, p) }),
    });
  }

  for (const len of filters.length ?? []) {
    out.push({
      key: `length:${len}`,
      label: LENGTH[len] ?? `${len} 小时`,
      clear: (f) => ({ ...f, length: without(f.length, len) }),
    });
  }

  for (const status of filters.devstatus ?? []) {
    out.push({
      key: `devstatus:${status}`,
      label: devStatusLabel(status as DevStatus),
      clear: (f) => ({ ...f, devstatus: without(f.devstatus, status) }),
    });
  }

  if (filters.releasedFrom || filters.releasedTo) {
    const from = filters.releasedFrom?.slice(0, 4) ?? "…";
    const to = filters.releasedTo?.slice(0, 4) ?? "今";
    out.push({
      key: "released",
      label: `${from} – ${to}`,
      clear: (f) => ({ ...f, releasedFrom: undefined, releasedTo: undefined }),
    });
  }

  if (filters.minVotecount) {
    out.push({
      key: "votecount",
      label: `票数 ≥ ${filters.minVotecount}`,
      clear: (f) => ({ ...f, minVotecount: undefined }),
    });
  }

  if (filters.hasDescription) {
    out.push({ key: "desc", label: "有简介", clear: (f) => ({ ...f, hasDescription: undefined }) });
  }
  if (filters.hasScreenshot) {
    out.push({ key: "shot", label: "有截图", clear: (f) => ({ ...f, hasScreenshot: undefined }) });
  }

  return out;
}

function without<T>(list: readonly T[] | undefined, value: T): T[] | undefined {
  if (!list) return undefined;
  const next = list.filter((v) => v !== value);
  return next.length > 0 ? next : undefined;
}

export interface FilterSummaryProps {
  filters: VnFilterState;
  onChange: (next: VnFilterState) => void;
}

export function FilterSummary({ filters, onChange }: FilterSummaryProps): JSX.Element | null {
  const active = describeFilters(filters);
  if (active.length === 0) return null;

  return (
    <View className="gap-2 border-b border-separator pb-3">
      <View className="flex-row items-center justify-between">
        <Muted type="body-xs">已选 {active.length} 项</Muted>
        <Pressable
          onPress={() => onChange({})}
          className="rounded-full px-2 py-0.5 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="清空全部筛选条件"
          hitSlop={8}
        >
          <Typography type="body-xs" className="font-semibold text-danger">
            清空
          </Typography>
        </Pressable>
      </View>

      <FilterChipRow active={active} filters={filters} onChange={onChange} />
    </View>
  );
}

export interface ActiveFilterStripProps {
  filters: VnFilterState;
  onChange: (next: VnFilterState) => void;
}

/**
 * 浏览页顶部的条件速览。
 *
 * 面板里改了条件之后，用户通常是把面板一关就回列表 —— 汇总条件必须留在列表上，
 * 否则「我到底筛了什么」就丢了。点标签上的 ✕ 可以就地撤销，不用重新打开面板。
 */
export function ActiveFilterStrip({
  filters,
  onChange,
}: ActiveFilterStripProps): JSX.Element | null {
  const active = describeFilters(filters);
  if (active.length === 0) return null;
  return <FilterChipRow active={active} filters={filters} onChange={onChange} />;
}

interface FilterChipRowProps {
  active: ActiveFilter[];
  filters: VnFilterState;
  onChange: (next: VnFilterState) => void;
}

/** 横向滚动的条件标签行，面板汇总条和列表速览共用 */
function FilterChipRow({ active, filters, onChange }: FilterChipRowProps): JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingRight: 16 }}
    >
      {active.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onChange(item.clear(filters))}
          className="flex-row items-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={`移除筛选条件 ${item.label}`}
        >
          <Typography type="body-xs" className="text-accent">
            {item.label}
          </Typography>
          <Typography type="body-xs" className="text-accent">
            ✕
          </Typography>
        </Pressable>
      ))}
    </ScrollView>
  );
}
