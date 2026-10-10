/**
 * 筛选面板 —— **全屏覆盖层，不用 BottomSheet**。
 *
 * ## 为什么弃用 BottomSheet
 *
 * 三个理由，任何一个都足够：
 *
 * 1. **触摸穿透**。HeroUI 的 `BottomSheet.Portal` 挂载即注册到全局 `PortalHost`，
 *    而 `PortalHost` 渲染在整棵导航树**之上**的一层全屏 `absoluteFill` 里。
 *    关闭时 gorhom 的 sheet 只是「停在屏幕下方」并未卸载，Android 上还可能停在
 *    index -1 附近露一条边 —— 那一层会吃掉触摸，表现为「进了浏览页就切不动 Tab」。
 *    我们之前靠「条件挂载 + 延时卸载」绕过去，那是绕，不是修。
 *
 * 2. **模态语义不对**。底部弹层适合「快速选一个」，而筛选是**长时间、多组、
 *    来回对比**的任务：里面还有 8 个分组、可展开的长列表。全屏才是对的容器。
 *
 * 3. **高度约束难搞**。之前反复和 gorhom 的自动高度、`max-h-[85%]`、
 *    `content-container` 的 `flex: 1` 打架，最后要靠绝对像素硬算。
 *
 * ## 交互
 *
 * 边改边生效（见 `FilterSheet` 旧版的说明），顶部固定汇总条，
 * 底部固定「已选 N 项 / 完成」。**不使用任何 Portal** ——
 * 就是一个 `absoluteFill` 的普通 View，铺在同层的最上面。
 * 因此它既不会穿透，也不会在关闭后残留。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Muted } from "@/components/muted";
import { useTranslation } from "@/hooks/use-translation";
import { LENGTH, type DevStatus, type Language, type Platform } from "@/lib/api/enums";
import type { VnFilterState } from "@/lib/api/filters";
import { devStatusLabel, languageLabel, platformLabel } from "@/utils/format";

import {
  FilterChip,
  MultiSelectGroup,
  SingleSelectGroup,
  type FilterChipOption,
} from "./filter-group";
import { FilterSummary, describeFilters } from "./filter-summary";
import { FullScreenPanel } from "./panel";

/** 常用语言放前面，减少滚动（标签渲染期用 `languageLabel()` 取） */
const POPULAR_LANGUAGES: Language[] = [
  "ja",
  "zh",
  "zh-Hans",
  "zh-Hant",
  "en",
  "ko",
  "fr",
  "de",
  "ru",
  "es",
  "it",
  "pt-br",
];

/** 常用平台放前面（标签渲染期用 `platformLabel()` 取） */
const POPULAR_PLATFORMS: Platform[] = [
  "win",
  "mac",
  "lin",
  "and",
  "ios",
  "web",
  "ps5",
  "ps4",
  "swi",
  "xbo",
];

/** 时长选项直接用 VNDB 的英文描述（VNDB 原文即英文，两种语言都不翻译） */
const LENGTH_OPTIONS: FilterChipOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: LENGTH[n] as string,
}));

const RATING_OPTIONS: FilterChipOption[] = [
  { value: "90", label: "90+" },
  { value: "85", label: "85+" },
  { value: "80", label: "80+" },
  { value: "70", label: "70+" },
];

/** 票数下限（标签渲染期翻译，模块级不存文案） */
const VOTECOUNTS = [10, 50, 100, 500] as const;

/** 发行年代：value 是 `releasedFrom` 的起始日期，标签渲染期翻译 */
const DECADE_YEARS = [2020, 2015, 2010, 2005, 2000] as const;

export interface FilterPanelProps {
  onClose: () => void;
  value: VnFilterState;
  onChange: (next: VnFilterState) => void;
  /** 当前筛选命中的条数，显示在底部；未加载完时传 undefined */
  resultCount?: number;
}

export function FilterPanel({
  onClose,
  value,
  onChange,
  resultCount,
}: FilterPanelProps): JSX.Element {
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  const activeCount = describeFilters(value).length;

  // 选项标签在渲染期取（语言可切换，模块级常量不能存文案）
  const languageOptions: FilterChipOption[] = POPULAR_LANGUAGES.map((l) => ({
    value: l,
    label: languageLabel(l),
  }));
  const platformOptions: FilterChipOption[] = POPULAR_PLATFORMS.map((p) => ({
    value: p,
    label: platformLabel(p),
  }));
  const votecountOptions: FilterChipOption[] = VOTECOUNTS.map((min) => ({
    value: String(min),
    label: t("browse.filter.votecountOption", { min }),
  }));
  const devStatusOptions: FilterChipOption[] = ([0, 1, 2] as DevStatus[]).map((n) => ({
    value: String(n),
    label: devStatusLabel(n),
  }));
  const decadeOptions: FilterChipOption[] = DECADE_YEARS.map((year) => ({
    value: `${year}-01-01`,
    label: t("browse.filter.releasedOption", { year }),
  }));

  const update = (patch: Partial<VnFilterState>): void => onChange({ ...value, ...patch });

  /** 多选切换。current 必须传已生效的值，否则会读到旧值 */
  const toggleList = <T extends string>(
    key: "olang" | "platform" | "lang" | "length",
    current: readonly T[] | undefined,
    picked: T
  ): void => {
    const list = current ?? [];
    update({
      [key]: list.includes(picked) ? list.filter((v) => v !== picked) : [...list, picked],
    } as Partial<VnFilterState>);
  };

  return (
    <FullScreenPanel
      title={t("browse.filter.title")}
      accessibilityLabel={t("browse.filter.title")}
      onClose={onClose}
      fixedHeader={<FilterSummary filters={value} onChange={onChange} />}
      footer={
        /* 底部固定条：条数 + 清空 */
        <View className="flex-row items-center justify-between gap-3 border-t border-separator px-4 py-3">
          <Muted type="body-xs">
            {activeCount === 0
              ? t("browse.filter.none")
              : resultCount != null
                ? t("browse.filter.selectedHits", { count: activeCount, hits: resultCount })
                : t("browse.filter.selected", { count: activeCount })}
          </Muted>
          <Pressable
            onPress={() => onChange({})}
            disabled={activeCount === 0}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              activeCount === 0 ? "border-border opacity-40" : "border-accent"
            }`}
            accessibilityRole="button"
            accessibilityLabel={t("browse.filter.clearAll")}
            accessibilityState={{ disabled: activeCount === 0 }}
          >
            <Typography type="body-xs" className="font-semibold text-accent">
              {t("common.clear")}
            </Typography>
          </Pressable>
        </View>
      }
    >
      <SingleSelectGroup
        label={t("browse.filter.rating")}
        options={RATING_OPTIONS}
        selected={value.ratingRange ? String(value.ratingRange[0]) : null}
        onSelect={(v) => update({ ratingRange: v ? [Number(v), 100] : undefined })}
      />

      <SingleSelectGroup
        label={t("browse.filter.votecount")}
        options={votecountOptions}
        selected={value.minVotecount ? String(value.minVotecount) : null}
        onSelect={(v) => update({ minVotecount: v ? Number(v) : undefined })}
      />

      <MultiSelectGroup
        label={t("browse.filter.olang")}
        options={languageOptions}
        selected={value.olang ?? []}
        onToggle={(v) => toggleList("olang", value.olang, v as Language)}
      />

      <MultiSelectGroup
        label={t("browse.filter.platform")}
        options={platformOptions}
        selected={value.platform ?? []}
        onToggle={(v) => toggleList("platform", value.platform, v as Platform)}
      />

      <MultiSelectGroup
        label={t("browse.filter.length")}
        options={LENGTH_OPTIONS}
        selected={(value.length ?? []).map(String)}
        onToggle={(v) => toggleList("length", (value.length ?? []).map(String), v)}
      />

      <SingleSelectGroup
        label={t("browse.filter.devstatus")}
        options={devStatusOptions}
        selected={value.devstatus ? String(value.devstatus[0]) : null}
        onSelect={(v) => update({ devstatus: v ? [Number(v) as DevStatus] : undefined })}
      />

      <SingleSelectGroup
        label={t("browse.filter.released")}
        options={decadeOptions}
        selected={value.releasedFrom ?? null}
        onSelect={(v) => update({ releasedFrom: v ?? undefined, releasedTo: undefined })}
      />

      <View className="gap-2">
        <Typography type="body-sm" className="font-semibold">
          {t("browse.filter.content")}
        </Typography>
        <View className="flex-row flex-wrap gap-1.5">
          <FilterChip
            option={{ value: "desc", label: t("browse.filter.hasDescription") }}
            active={Boolean(value.hasDescription)}
            onPress={() => update({ hasDescription: !value.hasDescription })}
          />
          <FilterChip
            option={{ value: "shot", label: t("browse.filter.hasScreenshot") }}
            active={Boolean(value.hasScreenshot)}
            onPress={() => update({ hasScreenshot: !value.hasScreenshot })}
          />
        </View>
      </View>

      {/* 给底部固定条留出空间，最后一个分组不会被压住 */}
      <View style={{ height: Math.max(0, height * 0.02) }} />
    </FullScreenPanel>
  );
}
