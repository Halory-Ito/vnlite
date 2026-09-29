/**
 * 背景滑杆的通用外壳。
 *
 * HeroUI Native 的 `Slider` 是复合组件（Root / Track / Fill / Thumb），
 * 每次用都要摆一遍子组件，这里包一层，顺手把「拖动不落盘」的逻辑收进来。
 *
 * ## 为什么拖动中不写 AsyncStorage
 *
 * `setPreference` 每次调用都会 `await kv.set(...)`，滑块拖一下能触发几十次
 * → 主线程被序列化/写盘打断，手感发涩。正确姿势：
 *   - `onChange`      → `patchPreferences`（只改内存，UI 立刻响应）
 *   - `onChangeEnd`   → `setPreference`（松手时落盘一次）
 *
 * 副作用正好是白送的：**背景图本来就是全局的，所以拖动滑杆时
 * 用户能直接看到整屏背景实时变化**，不需要额外做预览组件。
 */

import { Slider, Typography } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/Muted";

export interface LabeledSliderProps {
  label: string;
  hint?: string;
  /** 当前值 */
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  /** 读数后缀，如 "%" / " pt" */
  unit?: string;
  /** 读数放大倍率：0–1 的不透明度要 ×100 才好读 */
  displayScale?: number;
  onLiveChange: (value: number) => void;
  onCommit: (value: number) => void;
}

export function LabeledSlider({
  label,
  hint,
  value,
  minValue,
  maxValue,
  step,
  unit = "",
  displayScale = 1,
  onLiveChange,
  onCommit,
}: LabeledSliderProps): JSX.Element {
  const readValue = Math.round(value * displayScale);

  const handleLive = (next: number) => onLiveChange(roundToStep(next, step));
  const handleCommit = (next: number) => onCommit(roundToStep(next, step));

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Muted type="body-xs" className="font-medium">
          {label}
        </Muted>
        <Typography type="body-xs" className="font-semibold text-accent">
          {readValue}
          {unit}
        </Typography>
      </View>

      <Slider
        value={value}
        minValue={minValue}
        maxValue={maxValue}
        step={step}
        onChange={(next) => handleLive(scalar(next))}
        onChangeEnd={(next) => handleCommit(scalar(next))}
        accessibilityLabel={label}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>

      {hint ? <Muted type="body-xs">{hint}</Muted> : null}
    </View>
  );
}

/** `SliderValue` 允许是数组（区间模式），我们只用单值，取第一个 */
function scalar(next: number | number[]): number {
  return Array.isArray(next) ? (next[0] ?? 0) : next;
}

/**
 * 对齐到 `step` 的精度。
 *
 * step=0.01 的滑杆会吐出 `0.7000000000000001` 这种值 —— 显示上无所谓，
 * 但它会被写进 AsyncStorage，也会让 `useSyncExternalStore` 的快照每次都变，
 * 白白多渲染一轮。按 step 的小数位四舍五入掉。
 */
function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return decimals === 0 ? value : Number(value.toFixed(decimals));
}
