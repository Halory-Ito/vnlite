/**
 * 排行榜使用的横向 chip 行（年度 / 部门 / 任一横向单选组）。
 *
 * 横向 ScrollView 的两条抗拉伸护甲（RN 内置 `baseHorizontal` 的
 * `flexGrow: 1` 会在定高父容器里疯长），与题材面板行的坑同源：
 *   - `style={{ flexGrow: 0 }}`（根样式）
 *   - `contentContainerStyle` 里的 `alignItems: "center"`（子元素不被 stretch 拉高）
 */

import type { JSX, ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { Muted } from "@/components/typo";

export interface ChipRowProps {
  /** 行首的说明（如「选择年份」） */
  label: string;
  children: ReactNode;
}

export function ChipRow({ label, children }: ChipRowProps): JSX.Element {
  return (
    <View className="gap-1.5 pb-2">
      <Muted type="body-xs" className="px-4">
        {label}
      </Muted>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 2,
          alignItems: "center",
        }}
        style={{ flexGrow: 0 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
