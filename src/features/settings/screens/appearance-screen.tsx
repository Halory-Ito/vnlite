import { View } from "react-native";

import { SegmentedControl } from "@/components/segmented-control";
import { AppearanceGroup } from "@/features/settings/components/appearance-group";
import { AppearanceThemeSettings } from "@/features/settings/components/appearance-theme-settings";
import {
  CardAppearanceSettings,
  NavigationAppearanceSettings,
} from "@/features/settings/components/appearance-surface-settings";
import { BackgroundSettings } from "@/features/settings/components/background-settings";
import { LanguageSettings } from "@/features/settings/components/language-settings";
import { SettingsField } from "@/features/settings/components/settings-field";
import { SettingsShell } from "@/features/settings/components/settings-shell";
import { SCHEME_OPTIONS, translateOptions } from "@/features/settings/lib/options";
import { usePreference } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { setPreference } from "@/lib/storage/preferences";

export default function AppearanceScreen() {
  const colorScheme = usePreference("colorScheme");
  const { t } = useTranslation();

  return (
    <SettingsShell title={t("settings.appearanceTitle")}>
      <View className="w-full max-w-4xl self-center py-2">
        <AppearanceGroup title={t("settings.appearanceGeneral")}>
          <SettingsField label={t("settings.scheme")}>
            <SegmentedControl
              options={translateOptions(SCHEME_OPTIONS, t)}
              value={colorScheme}
              onChange={(value) => void setPreference("colorScheme", value)}
            />
          </SettingsField>
          <SettingsField label={t("settings.languageSection")}>
            <LanguageSettings />
          </SettingsField>
        </AppearanceGroup>
        <AppearanceGroup title={t("settings.appearanceColors")}>
          <AppearanceThemeSettings />
        </AppearanceGroup>
        <AppearanceGroup title={t("settings.background")}>
          <BackgroundSettings />
        </AppearanceGroup>
        <AppearanceGroup title={t("settings.cardSection")}>
          <CardAppearanceSettings />
        </AppearanceGroup>
        <AppearanceGroup title={t("settings.tabBarSection")}>
          <NavigationAppearanceSettings />
        </AppearanceGroup>
      </View>
    </SettingsShell>
  );
}
