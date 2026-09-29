/**
 * 分段控制器。
 *
 * HeroUI Native **没有** SegmentedControl（只有 Tabs / RadioGroup），
 * 而排序切换这种「互斥单选」用 Tabs 太重，所以自己实现一个。
 * 外观与 HeroUI 的 segmented 风格对齐，选项少（3–5 个）时体验最好。
 */

import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Typography } from "heroui-native";

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
    <View className={`flex-row rounded-lg bg-default-soft p-1 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center justify-center rounded-md py-1.5 ${active ? "bg-background" : ""}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Typography
              type="body-sm"
              className={active ? "font-semibold text-foreground" : "text-muted"}
            >
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
