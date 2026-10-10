/**
 * 日期筛选面板（Header 的时钟图标按钮打开）。
 *
 * 主路径是**自定义开始 / 结束日期**：用 `DateOtpField`（`InputOTP`，8 位数字
 * 逐位输入，不用敲 `-`）。上面一排快捷时间段只是把两个日期快速填好的捷径。
 *
 * 面板外壳与选项胶囊复用浏览页那套（`FullScreenPanel` + `FilterGroup` /
 * `FilterChip`）；草稿在面板内部（存 8 位数字），点「应用」才生效，
 * 未填满 / 日期无效 / 顺序错误都会挡住。
 */

import { Button } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { FilterChip, FilterGroup } from "@/features/browse/components/filter-group";
import { FullScreenPanel } from "@/features/browse/components/panel";
import { useTranslation } from "@/hooks/use-translation";

import { DateOtpField } from "./date-otp-field";
import {
  dateDigitsRangeErrors,
  digitsToIso,
  isoToDigits,
  presetDateFilter,
  historyPresetOptions,
  type HistoryDateFilter,
} from "../history-constants";

export interface TimeRangePanelProps {
  value: HistoryDateFilter;
  onChange: (next: HistoryDateFilter) => void;
  onClose: () => void;
}

/** 面板草稿：两端都是 8 位数字串 */
interface DateDraft {
  start: string;
  end: string;
}

export function TimeRangePanel({ value, onChange, onClose }: TimeRangePanelProps): JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DateDraft>(() => ({
    start: isoToDigits(value.start),
    end: isoToDigits(value.end),
  }));
  const errors = dateDigitsRangeErrors(draft.start, draft.end);
  const valid = !errors.start && !errors.end;

  const apply = (): void => {
    if (!valid) return;
    onChange({ start: digitsToIso(draft.start), end: digitsToIso(draft.end) });
    onClose();
  };

  return (
    <FullScreenPanel
      title={t("history.timeRange")}
      accessibilityLabel={t("history.timeRange")}
      onClose={onClose}
      footer={
        <View className="flex-row items-center justify-between gap-3 border-t border-separator px-4 py-3">
          <Button size="sm" variant="ghost" onPress={() => setDraft({ start: "", end: "" })}>
            <Button.Label>{t("common.reset")}</Button.Label>
          </Button>
          <Button size="sm" onPress={apply} isDisabled={!valid}>
            <Button.Label>{t("common.apply")}</Button.Label>
          </Button>
        </View>
      }
    >
      <FilterGroup label={t("history.quickSelect")}>
        {historyPresetOptions(t).map((option) => {
          const preset = presetDateFilter(option.value);
          const active =
            draft.start === isoToDigits(preset.start) && draft.end === isoToDigits(preset.end);
          return (
            <FilterChip
              key={option.value}
              option={option}
              active={active}
              onPress={() =>
                setDraft({
                  start: isoToDigits(preset.start),
                  end: isoToDigits(preset.end),
                })
              }
            />
          );
        })}
      </FilterGroup>

      <View className="gap-4">
        <DateOtpField
          label={t("history.startDate")}
          value={draft.start}
          onChange={(start) => setDraft((prev) => ({ ...prev, start }))}
          error={errors.start ? t(errors.start) : null}
        />
        <DateOtpField
          label={t("history.endDate")}
          value={draft.end}
          onChange={(end) => setDraft((prev) => ({ ...prev, end }))}
          error={errors.end ? t(errors.end) : null}
        />
      </View>
    </FullScreenPanel>
  );
}
