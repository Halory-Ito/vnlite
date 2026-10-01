/**
 * 外观设置：明暗模式 / 主题 / 背景图。
 *
 * 全部改完即生效（没有「保存」按钮）：主题是全局的，改一下整屏跟着变，
 * 也就是天然的实时预览。
 */

import { useColorScheme, View } from "react-native";
import type { JSX } from "react";

import { SegmentedControl } from "@/components/segmented-control";
import { BackgroundSettings } from "@/features/settings/components/background-settings";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { SCHEME_OPTIONS } from "@/features/settings/options";
import { usePreferences } from "@/hooks/use-preferences";
import { setPreference } from "@/lib/storage/preferences";
import { resolveMode, THEMES } from "@/theme/themes";
import { ThemeTile } from "@/theme/theme-tile";

export default function AppearanceScreen(): JSX.Element {
  const preferences = usePreferences();
  const systemScheme = useColorScheme();
  // 主题 tile 的色块按**当前生效的模式**取色，而不是主题自带的明暗
  const mode = resolveMode(preferences.colorScheme, systemScheme);

  return (
    <SettingsShell title="外观">
      <SettingsSection title="明暗模式">
        <SegmentedControl
          options={SCHEME_OPTIONS}
          value={preferences.colorScheme}
          onChange={(value) => setPreference("colorScheme", value)}
        />
      </SettingsSection>

      <SettingsSection title="主题">
        <View className="flex-row flex-wrap gap-2">
          {THEMES.map((theme) => (
            <ThemeTile
              key={theme.id}
              theme={theme}
              mode={mode}
              active={preferences.themeId === theme.id}
              onPress={() => setPreference("themeId", theme.id)}
            />
          ))}
        </View>
      </SettingsSection>

      <SettingsSection title="背景图">
        <BackgroundSettings />
      </SettingsSection>
    </SettingsShell>
  );
}
