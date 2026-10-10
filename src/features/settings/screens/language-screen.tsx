/**
 * 语言设置：用 HeroUI 的 `Select` 选择界面语言（跟随系统 / 简体中文 / English）。
 *
 * 改完立即生效（`setPreference` → 偏好订阅 → 全局 `t` 同步 + `useTranslation` 重渲染）。
 */

import { Select } from "heroui-native";
import type { JSX } from "react";

import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { LANGUAGE_OPTIONS, translateOptions } from "@/features/settings/options";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { Language } from "@/lib/i18n/translate";
import { setPreference } from "@/lib/storage/preferences";

export default function LanguageScreen(): JSX.Element {
  const preferences = usePreferences();
  const { t } = useTranslation();
  const options = translateOptions(LANGUAGE_OPTIONS, t);
  const selected = options.find((option) => option.value === preferences.language) ?? options[0];

  return (
    <SettingsShell title={t("settings.languageTitle")}>
      <SettingsSection title={t("settings.languageSection")} hint={t("settings.languageHint")}>
        <Select
          value={selected}
          onValueChange={(option) => {
            // 单选：值一定是单个 SelectOption；按选项表校验后再写入偏好
            const first = Array.isArray(option) ? option[0] : option;
            const picked = first?.value;
            const language = LANGUAGE_OPTIONS.find((item) => item.value === picked)?.value;
            if (language) void setPreference("language", language as Language);
          }}
        >
          <Select.Trigger className="w-full">
            <Select.Value placeholder={selected.label} />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} label={option.label} />
              ))}
            </Select.Content>
          </Select.Portal>
        </Select>
      </SettingsSection>
    </SettingsShell>
  );
}
