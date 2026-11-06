/**
 * 分段控制器。
 *
 * 复用 HeroUI Tabs，选中块和文字使用主题 segment 配色。
 */

import type { JSX } from "react";
import { Tabs } from "heroui-native";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const option = options.find((item) => item.value === next);
        if (option) onChange(option.value);
      }}
      className={className}
    >
      <Tabs.List className="w-full rounded-lg bg-default p-1">
        <Tabs.Indicator className="rounded-md bg-segment" />
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            className="min-w-0 flex-1 px-1 py-1.5"
          >
            <Tabs.Label
              className={`text-sm ${option.value === value ? "font-semibold text-segment-foreground" : "text-muted"}`}
            >
              {option.label}
            </Tabs.Label>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
