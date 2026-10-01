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
import {
  LANGUAGE_LABEL,
  LENGTH,
  PLATFORM_LABEL,
  type DevStatus,
  type Language,
  type Platform,
} from "@/lib/api/enums";
import type { VnFilterState } from "@/lib/api/filters";
import { devStatusLabel } from "@/utils/format";

import {
  FilterChip,
  MultiSelectGroup,
  SingleSelectGroup,
  type FilterChipOption,
} from "./filter-group";
import { FilterSummary, describeFilters } from "./filter-summary";
import { FullScreenPanel } from "./panel";

/** 常用语言放前面，减少滚动 */
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
const LANGUAGE_OPTIONS: FilterChipOption[] = POPULAR_LANGUAGES.map((l) => ({
  value: l,
  label: LANGUAGE_LABEL[l],
}));

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
const PLATFORM_OPTIONS: FilterChipOption[] = POPULAR_PLATFORMS.map((p) => ({
  value: p,
  label: PLATFORM_LABEL[p],
}));

const LENGTH_OPTIONS: FilterChipOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: LENGTH[n] as string,
}));

const DEV_STATUS_OPTIONS: FilterChipOption[] = ([0, 1, 2] as DevStatus[]).map((n) => ({
  value: String(n),
  label: devStatusLabel(n),
}));

const RATING_OPTIONS: FilterChipOption[] = [
  { value: "90", label: "90+" },
  { value: "85", label: "85+" },
  { value: "80", label: "80+" },
  { value: "70", label: "70+" },
];

const VOTECOUNT_OPTIONS: FilterChipOption[] = [
  { value: "10", label: "≥10 票" },
  { value: "50", label: "≥50 票" },
  { value: "100", label: "≥100 票" },
  { value: "500", label: "≥500 票" },
];

const DECADE_OPTIONS: FilterChipOption[] = [
  { value: "2020-01-01", label: "2020 起" },
  { value: "2015-01-01", label: "2015 起" },
  { value: "2010-01-01", label: "2010 起" },
  { value: "2005-01-01", label: "2005 起" },
  { value: "2000-01-01", label: "2000 起" },
];

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
  const activeCount = describeFilters(value).length;

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
      title="筛选"
      accessibilityLabel="筛选"
      onClose={onClose}
      fixedHeader={<FilterSummary filters={value} onChange={onChange} />}
      footer={
        /* 底部固定条：条数 + 清空 */
        <View className="flex-row items-center justify-between gap-3 border-t border-separator px-4 py-3">
          <Muted type="body-xs">
            {activeCount === 0
              ? "未设置筛选条件"
              : `已选 ${activeCount} 项${resultCount != null ? ` · 命中 ${resultCount} 个` : ""}`}
          </Muted>
          <Pressable
            onPress={() => onChange({})}
            disabled={activeCount === 0}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              activeCount === 0 ? "border-border opacity-40" : "border-accent"
            }`}
            accessibilityRole="button"
            accessibilityLabel="清空全部筛选条件"
            accessibilityState={{ disabled: activeCount === 0 }}
          >
            <Typography type="body-xs" className="font-semibold text-accent">
              清空
            </Typography>
          </Pressable>
        </View>
      }
    >
      <SingleSelectGroup
        label="最低评分"
        options={RATING_OPTIONS}
        selected={value.ratingRange ? String(value.ratingRange[0]) : null}
        onSelect={(v) => update({ ratingRange: v ? [Number(v), 100] : undefined })}
      />

      <SingleSelectGroup
        label="最少投票数"
        options={VOTECOUNT_OPTIONS}
        selected={value.minVotecount ? String(value.minVotecount) : null}
        onSelect={(v) => update({ minVotecount: v ? Number(v) : undefined })}
      />

      <MultiSelectGroup
        label="原语言"
        options={LANGUAGE_OPTIONS}
        selected={value.olang ?? []}
        onToggle={(v) => toggleList("olang", value.olang, v as Language)}
      />

      <MultiSelectGroup
        label="平台"
        options={PLATFORM_OPTIONS}
        selected={value.platform ?? []}
        onToggle={(v) => toggleList("platform", value.platform, v as Platform)}
      />

      <MultiSelectGroup
        label="时长"
        options={LENGTH_OPTIONS}
        selected={(value.length ?? []).map(String)}
        onToggle={(v) => toggleList("length", (value.length ?? []).map(String), v)}
      />

      <SingleSelectGroup
        label="开发状态"
        options={DEV_STATUS_OPTIONS}
        selected={value.devstatus ? String(value.devstatus[0]) : null}
        onSelect={(v) => update({ devstatus: v ? [Number(v) as DevStatus] : undefined })}
      />

      <SingleSelectGroup
        label="发行年代"
        options={DECADE_OPTIONS}
        selected={value.releasedFrom ?? null}
        onSelect={(v) => update({ releasedFrom: v ?? undefined, releasedTo: undefined })}
      />

      <View className="gap-2">
        <Typography type="body-sm" className="font-semibold">
          内容完整度
        </Typography>
        <View className="flex-row flex-wrap gap-1.5">
          <FilterChip
            option={{ value: "desc", label: "有简介" }}
            active={Boolean(value.hasDescription)}
            onPress={() => update({ hasDescription: !value.hasDescription })}
          />
          <FilterChip
            option={{ value: "shot", label: "有截图" }}
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
