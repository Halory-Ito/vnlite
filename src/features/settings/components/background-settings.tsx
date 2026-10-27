/**
 * 背景设置面板。
 *
 * 控制项：
 *   - 是否显示背景图（开关）
 *   - 自定义背景图：从相册选图 / 恢复主题自带
 *   - 遮罩不透明度 0–100%（`backgroundOpacity`）
 *   - 背景图模糊半径 0–40 pt（`backgroundBlur`）
 *   - 背景图位置 X / Y（0–100%，只挪动被 `cover` 裁掉的部分）
 *
 * ## 关于「实时预览」
 *
 * 不需要额外的预览卡片：背景图是**全局**的（`ThemeProvider` 铺在最底层），
 * 所以拖动滑杆 / 换图时整屏背景就在变，所见即所得。
 * 也正因为它全局可见，这里的数值必须诚实 —— 拖到 0% 文字真的会糊。
 */

import { Button, Switch, useToast } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Paragraph } from "@/components/typo";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import {
  BACKGROUND_BLUR_RANGE,
  BACKGROUND_OPACITY_RANGE,
  BACKGROUND_POSITION_RANGE,
  patchPreferences,
  setPreference,
  type Preferences,
} from "@/lib/storage/preferences";

import {
  clearBackgroundImages,
  pickBackgroundImage,
} from "@/features/settings/lib/background-image";

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

      {preferences.showBackground ? (
        <>
          <BackgroundImagePicker hasCustom={preferences.backgroundUrl !== null} />
          <BackgroundSliders preferences={preferences} />
        </>
      ) : null}
    </View>
  );
}

/** 选图 / 恢复主题自带背景 */
function BackgroundImagePicker({ hasCustom }: { hasCustom: boolean }): JSX.Element {
  const { t } = useTranslation();
  const { toast } = useToast();

  const onPick = (): void => {
    void pickBackgroundImage().then((result) => {
      if (result.status === "saved") {
        void setPreference("backgroundUrl", result.uri);
        toast.show(t("settings.backgroundImageSaved"));
      } else if (result.status === "failed") {
        toast.show(t("settings.backgroundImageFailed"));
      }
    });
  };

  const onReset = (): void => {
    clearBackgroundImages();
    void setPreference("backgroundUrl", null);
    toast.show(t("settings.backgroundImageRemoved"));
  };

  return (
    <View className="gap-2">
      <View className="flex-row gap-3">
        <Button size="sm" variant="secondary" className="flex-1" onPress={onPick}>
          <Button.Label>{t("settings.chooseBackground")}</Button.Label>
        </Button>
        {hasCustom ? (
          <Button size="sm" variant="ghost" className="flex-1" onPress={onReset}>
            <Button.Label>{t("settings.resetBackground")}</Button.Label>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function BackgroundSliders({ preferences }: { preferences: Preferences }): JSX.Element {
  const { t } = useTranslation();
  const { backgroundOpacity, backgroundBlur, backgroundPosition } = preferences;

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

      <LabeledSlider
        label={t("settings.backgroundPositionX")}
        value={backgroundPosition.x}
        minValue={BACKGROUND_POSITION_RANGE.min}
        maxValue={BACKGROUND_POSITION_RANGE.max}
        step={BACKGROUND_POSITION_RANGE.step}
        displayScale={100}
        unit="%"
        onLiveChange={(value) =>
          patchPreferences({ backgroundPosition: { ...backgroundPosition, x: value } })
        }
        onCommit={(value) =>
          void setPreference("backgroundPosition", { ...backgroundPosition, x: value })
        }
      />

      <LabeledSlider
        label={t("settings.backgroundPositionY")}
        value={backgroundPosition.y}
        minValue={BACKGROUND_POSITION_RANGE.min}
        maxValue={BACKGROUND_POSITION_RANGE.max}
        step={BACKGROUND_POSITION_RANGE.step}
        displayScale={100}
        unit="%"
        onLiveChange={(value) =>
          patchPreferences({ backgroundPosition: { ...backgroundPosition, y: value } })
        }
        onCommit={(value) =>
          void setPreference("backgroundPosition", { ...backgroundPosition, y: value })
        }
      />
    </View>
  );
}
