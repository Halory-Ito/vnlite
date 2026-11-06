import { SegmentedControl } from "@/components/segmented-control";
import { LabeledSlider } from "@/features/settings/components/labeled-slider";
import { SettingsField } from "@/features/settings/components/settings-field";
import { useDebouncedPreferenceCommit } from "@/features/settings/hooks/use-debounced-preference-commit";
import {
  TAB_BAR_ANIMATION_OPTIONS,
  TAB_BAR_STYLE_OPTIONS,
  translateOptions,
} from "@/features/settings/lib/options";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import {
  CARD_OPACITY_RANGE,
  IMAGE_RADIUS_RANGE,
  patchPreferences,
  setPreference,
} from "@/lib/storage/preferences";

export function NavigationAppearanceSettings() {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const commitOpacity = useDebouncedPreferenceCommit("tabBarOpacity");
  const commitBlur = useDebouncedPreferenceCommit("tabBarBlur");
  const commitGlassStrength = useDebouncedPreferenceCommit("tabBarGlassStrength");

  return (
    <>
      <SettingsField label={t("settings.tabBarStyle")}>
        <SegmentedControl
          options={translateOptions(TAB_BAR_STYLE_OPTIONS, t)}
          value={preferences.tabBarStyle}
          onChange={(value) => {
            if (value === "glass" && preferences.tabBarBlur === 0)
              patchPreferences({ tabBarBlur: 8 });
            void setPreference("tabBarStyle", value);
          }}
        />
      </SettingsField>
      <SettingsField label={t("settings.tabBarAnimation")}>
        <SegmentedControl
          options={translateOptions(TAB_BAR_ANIMATION_OPTIONS, t)}
          value={preferences.tabBarAnimation}
          onChange={(value) => void setPreference("tabBarAnimation", value)}
        />
      </SettingsField>
      <LabeledSlider
        label={t("settings.tabBarOpacity")}
        value={preferences.tabBarOpacity}
        minValue={0}
        maxValue={1}
        step={0.01}
        displayScale={100}
        unit="%"
        onLiveChange={(value) => patchPreferences({ tabBarOpacity: value })}
        onCommit={commitOpacity}
      />
      <LabeledSlider
        label={t("settings.tabBarBlur")}
        value={preferences.tabBarBlur}
        minValue={0}
        maxValue={16}
        step={1}
        onLiveChange={(value) => patchPreferences({ tabBarBlur: value })}
        onCommit={commitBlur}
      />
      {preferences.tabBarStyle === "glass" ? (
        <LabeledSlider
          label={t("settings.tabBarGlassStrength")}
          value={preferences.tabBarGlassStrength}
          minValue={0}
          maxValue={2}
          step={0.01}
          displayScale={100}
          unit="%"
          onLiveChange={(value) => patchPreferences({ tabBarGlassStrength: value })}
          onCommit={commitGlassStrength}
        />
      ) : null}
    </>
  );
}

export function CardAppearanceSettings() {
  const preferences = usePreferences();
  const { t } = useTranslation();
  return (
    <>
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
    </>
  );
}
