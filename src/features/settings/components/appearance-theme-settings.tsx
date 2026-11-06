import { useColorScheme, View } from "react-native";

import { ColorField } from "@/features/settings/components/color-field";
import { SettingsField } from "@/features/settings/components/settings-field";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { CUSTOM_THEME_ID, setPreference } from "@/lib/storage/preferences";
import { resolveMode, resolveTheme, THEMES } from "@/theme/themes";
import { ThemeTile } from "@/theme/theme-tile";

export function AppearanceThemeSettings() {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const systemScheme = useColorScheme();
  const mode = resolveMode(preferences.colorScheme, systemScheme);
  const customTheme = resolveTheme(
    CUSTOM_THEME_ID,
    preferences.customTheme,
    t("settings.themeCustom")
  );
  const customTile = preferences.backgroundUrl
    ? { ...customTheme, background: { uri: preferences.backgroundUrl } }
    : customTheme;
  const setPart = (part: "primary" | "secondary", hex: string) => {
    void setPreference("customTheme", { ...preferences.customTheme, [part]: hex });
  };

  return (
    <>
      <SettingsField label={t("settings.theme")}>
        <View className="flex-row flex-wrap justify-center gap-2">
          {[...THEMES, customTile].map((theme) => (
            <ThemeTile
              key={theme.id}
              theme={theme}
              mode={mode}
              active={preferences.themeId === theme.id}
              onPress={() => void setPreference("themeId", theme.id)}
            />
          ))}
        </View>
      </SettingsField>
      {preferences.themeId === CUSTOM_THEME_ID ? (
        <>
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
        </>
      ) : null}
    </>
  );
}
