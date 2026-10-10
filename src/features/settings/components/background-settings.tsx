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

import { Paragraph } from "@/components/typo";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import {
  BACKGROUND_BLUR_RANGE,
  BACKGROUND_OPACITY_RANGE,
  patchPreferences,
  setPreference,
  type Preferences,
} from "@/lib/storage/preferences";

import { LabeledSlider } from "./labeled-slider";

export function BackgroundSettings(): JSX.Element {
  const preferences = usePreferences();
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Paragraph className="text-sm">{t("settings.showBackground")}</Paragraph>
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
  const { t } = useTranslation();
  const { backgroundOpacity, backgroundBlur } = preferences;

  return (
    <View className="gap-5">
      <LabeledSlider
        label={t("settings.backgroundOpacity")}
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
        label={t("settings.backgroundBlur")}
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
