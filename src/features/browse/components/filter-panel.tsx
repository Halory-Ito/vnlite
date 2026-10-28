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
 * 边改边生效，顶部固定汇总条，底部固定「已选 N 项 / 完成」。
 * **不使用任何 Portal**：就是一个 `absoluteFill` 普通视图铺在同层最上面，
 * 关闭即整棵子树消失 —— 不会穿透，也不会残留。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";

import { Muted } from "@/components/muted";
import { useTranslation } from "@/hooks/use-translation";
import type { DevStatus, Language, Platform } from "@/lib/api/enums";
import type { VnFilterState } from "@/lib/api/filters";
import { devStatusLabel, languageLabel, platformLabel } from "@/utils/format";

import {
  DECADE_YEARS,
  DEV_STATUS_VALUES,
  LENGTH_OPTIONS,
  POPULAR_LANGUAGES,
  POPULAR_PLATFORMS,
  RATING_OPTIONS,
  VOTECOUNTS,
} from "@/features/browse/lib/filter-options";
import {
  FilterChip,
  MultiSelectGroup,
  SingleSelectGroup,
  type FilterChipOption,
} from "./filter-group";
import { FilterTagGroup } from "./filter-tag-group";
import { FilterSummary, describeFilters } from "./filter-summary";
import { FullScreenPanel } from "./panel";

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
  const devStatusOptions: FilterChipOption[] = DEV_STATUS_VALUES.map((n) => ({
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

      <FilterTagGroup filters={value} update={update} />

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

      <View style={{ height: Math.max(0, height * 0.02) }} />
    </FullScreenPanel>
  );
}
