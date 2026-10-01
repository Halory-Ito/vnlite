/**
 * 打分输入：10–100 滑杆。
 *
 * 未打分时先显示一个「打分」按钮（默认 70 起步），避免滑杆在
 * `null` 状态下显示一个假的初始值。松手不直接提交 ——
 * 提交由编辑页底部的「保存」统一做（表单语义，一次入队）。
 */

import { Button, Slider, Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "@/components/typo";

export interface VoteFieldProps {
  vote: number | null;
  onChange: (vote: number | null) => void;
}

export function VoteField({ vote, onChange }: VoteFieldProps): JSX.Element {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Muted type="body-xs" className="font-medium">
          打分
        </Muted>
        {vote != null ? (
          <View className="flex-row items-center gap-3">
            <Typography type="body-sm" className="font-semibold text-accent">
              {vote} / 100
            </Typography>
            <Pressable
              onPress={() => onChange(null)}
              className="active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="清除打分"
            >
              <Typography type="body-xs" className="text-muted">
                清除
              </Typography>
            </Pressable>
          </View>
        ) : (
          <Muted type="body-xs">未打分</Muted>
        )}
      </View>

      {vote == null ? (
        <Button size="sm" variant="secondary" className="self-start" onPress={() => onChange(70)}>
          <Button.Label>打分（10–100）</Button.Label>
        </Button>
      ) : (
        <Slider
          value={vote}
          minValue={10}
          maxValue={100}
          step={1}
          onChange={(next) => onChange(scalar(next))}
          accessibilityLabel="打分"
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
      )}
    </View>
  );
}

/** `SliderValue` 允许是数组（区间模式），我们只用单值 */
function scalar(next: number | number[]): number {
  return Array.isArray(next) ? (next[0] ?? 70) : next;
}
