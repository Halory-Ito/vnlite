/**
 * 外观设置：明暗模式 / 主题（含自定义）/ 背景图。
 *
 * 全部改完即生效（没有「保存」按钮）：主题是全局的，改一下整屏跟着变，
 * 也就是天然的实时预览。
 *
 * 「自定义」是主题列表里的最后一格：选中后展开主 / 辅色编辑器。
 * 自定义主题的背景图沿用下方「背景图」区块的选图，不另存一份。
 */

import { useColorScheme, View } from "react-native";
import type { JSX } from "react";

import { SegmentedControl } from "@/components/segmented-control";
import { TranslucentPanel } from "@/components/translucent-panel";
import { Muted, Paragraph } from "@/components/typo";
import { BackgroundSettings } from "@/features/settings/components/background-settings";
import { useDebouncedPreferenceCommit } from "@/features/settings/hooks/use-debounced-preference-commit";
import { ColorField } from "@/features/settings/components/color-field";
import { LabeledSlider } from "@/features/settings/components/labeled-slider";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import {
  SCHEME_OPTIONS,
  TAB_BAR_ANIMATION_OPTIONS,
  TAB_BAR_STYLE_OPTIONS,
  translateOptions,
} from "@/features/settings/lib/options";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import {
  CARD_OPACITY_RANGE,
  CUSTOM_THEME_ID,
  IMAGE_RADIUS_RANGE,
  patchPreferences,
  setPreference,
} from "@/lib/storage/preferences";
import { resolveMode, resolveTheme, THEMES } from "@/theme/themes";
import { ThemeTile } from "@/theme/theme-tile";

export default function AppearanceScreen(): JSX.Element {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const systemScheme = useColorScheme();
  // 主题 tile 的色块按**当前生效的模式**取色，而不是主题自带的明暗
  const mode = resolveMode(preferences.colorScheme, systemScheme);
  const customActive = preferences.themeId === CUSTOM_THEME_ID;
  const commitTabBarOpacity = useDebouncedPreferenceCommit("tabBarOpacity");
  const commitTabBarBlur = useDebouncedPreferenceCommit("tabBarBlur");
  const customTheme = resolveTheme(
    CUSTOM_THEME_ID,
    preferences.customTheme,
    t("settings.themeCustom")
  );
  // 自定义那一格用**已经选好的背景图**做缩略，否则用兜底图
  const customTile = preferences.backgroundUrl
    ? { ...customTheme, background: { uri: preferences.backgroundUrl } }
    : customTheme;

  return (
    <SettingsShell title={t("settings.appearanceTitle")}>
      {/*
       * 明暗模式与主题**不包卡片**（Master 要求）：两者都是「平铺一排选项」，
       * 套一层半透明底板反而多出一圈无意义的边框与内边距。
       */}
      <SettingsSection title={t("settings.scheme")}>
        <SegmentedControl
          options={translateOptions(SCHEME_OPTIONS, t)}
          value={preferences.colorScheme}
          onChange={(value) => void setPreference("colorScheme", value)}
        />
      </SettingsSection>

      <SettingsSection title={t("settings.theme")}>
        <View className="flex-row flex-wrap gap-2">
          {THEMES.map((theme) => (
            <ThemeTile
              key={theme.id}
              theme={theme}
              mode={mode}
              active={preferences.themeId === theme.id}
              onPress={() => void setPreference("themeId", theme.id)}
            />
          ))}
          <ThemeTile
            theme={customTile}
            mode={mode}
            active={customActive}
            onPress={() => void setPreference("themeId", CUSTOM_THEME_ID)}
          />
        </View>

        {customActive ? <CustomThemeEditor /> : null}
      </SettingsSection>

      <SettingsSection title={t("settings.tabBarSection")}>
        <SegmentedControl
          options={translateOptions(TAB_BAR_STYLE_OPTIONS, t)}
          value={preferences.tabBarStyle}
          onChange={(value) => {
            if (value === "glass" && preferences.tabBarBlur === 0) {
              patchPreferences({ tabBarBlur: 8 });
            }
            void setPreference("tabBarStyle", value);
          }}
        />
        <Paragraph className="mt-2 text-sm">{t("settings.tabBarAnimation")}</Paragraph>
        <SegmentedControl
          options={translateOptions(TAB_BAR_ANIMATION_OPTIONS, t)}
          value={preferences.tabBarAnimation}
          onChange={(value) => void setPreference("tabBarAnimation", value)}
        />
        <View className="mt-3 gap-4">
          <LabeledSlider
            label={t("settings.tabBarOpacity")}
            value={preferences.tabBarOpacity}
            minValue={0}
            maxValue={1}
            step={0.01}
            displayScale={100}
            unit="%"
            onLiveChange={(value) => patchPreferences({ tabBarOpacity: value })}
            onCommit={commitTabBarOpacity}
          />
          <LabeledSlider
            label={t("settings.tabBarBlur")}
            value={preferences.tabBarBlur}
            minValue={0}
            maxValue={16}
            step={1}
            onLiveChange={(value) => patchPreferences({ tabBarBlur: value })}
            onCommit={commitTabBarBlur}
          />
        </View>
      </SettingsSection>

      <SettingsSection title={t("settings.cardSection")}>
        <TranslucentPanel>
          <View className="gap-4">
            <LabeledSlider
              label={t("settings.imageRadius")}
              value={preferences.imageRadius}
              minValue={IMAGE_RADIUS_RANGE.min}
              maxValue={IMAGE_RADIUS_RANGE.max}
              step={IMAGE_RADIUS_RANGE.step}
              unit=" dp"
              onLiveChange={(value) => patchPreferences({ imageRadius: value })}
              onCommit={(value) => void setPreference("imageRadius", value)}
            />
            <LabeledSlider
              label={t("settings.cardOpacity")}
              value={preferences.cardOpacity}
              minValue={CARD_OPACITY_RANGE.min}
              maxValue={CARD_OPACITY_RANGE.max}
              step={CARD_OPACITY_RANGE.step}
              displayScale={100}
              unit="%"
              onLiveChange={(value) => patchPreferences({ cardOpacity: value })}
              onCommit={(value) => void setPreference("cardOpacity", value)}
            />
          </View>
        </TranslucentPanel>
      </SettingsSection>

      <SettingsSection title={t("settings.background")}>
        <TranslucentPanel>
          <BackgroundSettings />
        </TranslucentPanel>
      </SettingsSection>
    </SettingsShell>
  );
}

/** 自定义主题的主 / 辅色编辑（选「自定义」之后才出现） */
function CustomThemeEditor(): JSX.Element {
  const preferences = usePreferences();
  const { t } = useTranslation();

  const setPart = (part: "primary" | "secondary", hex: string): void => {
    void setPreference("customTheme", { ...preferences.customTheme, [part]: hex });
  };

  return (
    <View className="mt-4 gap-4 border-t border-separator pt-4">
      <ColorField
        label={t("settings.customPrimary")}
        value={preferences.customTheme.primary}
        onChange={(hex) => setPart("primary", hex)}
      />
      <ColorField
        label={t("settings.customSecondary")}
        value={preferences.customTheme.secondary}
        onChange={(hex) => setPart("secondary", hex)}
      />
      <Muted type="body-xs">{t("settings.customThemeHint")}</Muted>
    </View>
  );
}
