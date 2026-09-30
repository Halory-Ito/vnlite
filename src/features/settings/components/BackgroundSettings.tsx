/**
 * 背景设置面板。
 *
 * 三个控制项：
 *   - 是否显示背景图（开关）
 *   - 遮罩不透明度 0–100%（`backgroundOpacity`）
 *   - 背景图模糊半径 0–40 pt（`backgroundBlur`）
 *
 * ## 关于「实时预览」
 *
 * 不需要额外的预览卡片：背景图是**全局**的（`ThemeProvider` 铺在最底层），
 * 所以拖动滑杆时整屏背景就在变，所见即所得。
 * 也正因为它全局可见，这里的数值必须诚实 —— 拖到 0% 文字真的会糊。
 */

import { Switch } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/Muted";
import { Paragraph } from "@/components/Typo";
import { usePreferences } from "@/hooks/usePreferences";
import {
  BACKGROUND_BLUR_RANGE,
  BACKGROUND_OPACITY_RANGE,
  patchPreferences,
  setPreference,
  type Preferences,
} from "@/lib/storage/preferences";

import { LabeledSlider } from "./LabeledSlider";

export function BackgroundSettings(): JSX.Element {
  const preferences = usePreferences();

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Paragraph className="text-sm">显示背景图</Paragraph>
          <Muted type="body-xs">关闭后只保留配色</Muted>
        </View>
        <Switch
          isSelected={preferences.showBackground}
          onSelectedChange={(value: boolean) => setPreference("showBackground", value)}
        />
      </View>

      {preferences.showBackground ? <BackgroundSliders preferences={preferences} /> : null}
    </View>
  );
}

function BackgroundSliders({ preferences }: { preferences: Preferences }): JSX.Element {
  const { backgroundOpacity, backgroundBlur } = preferences;

  return (
    <View className="gap-5">
      <LabeledSlider
        label="遮罩透明度"
        hint="遮罩盖在背景图上、颜色与主题底色一致。0% 是原图，100% 完全盖住。调低更出图，调高文字更清楚。"
        value={backgroundOpacity}
        minValue={BACKGROUND_OPACITY_RANGE.min}
        maxValue={BACKGROUND_OPACITY_RANGE.max}
        step={BACKGROUND_OPACITY_RANGE.step}
        displayScale={100}
        unit="%"
        onLiveChange={(value) => patchPreferences({ backgroundOpacity: value })}
        onCommit={(value) => void setPreference("backgroundOpacity", value)}
      />

      <LabeledSlider
        label="背景模糊"
        hint="在遮罩之上再糊一层，进一步压掉细节换对比度。0 为不模糊。"
        value={backgroundBlur}
        minValue={BACKGROUND_BLUR_RANGE.min}
        maxValue={BACKGROUND_BLUR_RANGE.max}
        step={BACKGROUND_BLUR_RANGE.step}
        unit=" pt"
        onLiveChange={(value) => patchPreferences({ backgroundBlur: value })}
        onCommit={(value) => void setPreference("backgroundBlur", value)}
      />
    </View>
  );
}
