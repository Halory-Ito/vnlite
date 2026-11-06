import { Select } from "heroui-native";

import { LANGUAGE_OPTIONS, translateOptions } from "@/features/settings/lib/options";
import { usePreference } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { setPreference } from "@/lib/storage/preferences";

export function LanguageSettings() {
  const language = usePreference("language");
  const { t } = useTranslation();
  const options = translateOptions(LANGUAGE_OPTIONS, t);
  const selected = options.find((option) => option.value === language) ?? options[0]!;

  return (
    <Select
      value={selected}
      onValueChange={(option) => {
        const first = Array.isArray(option) ? option[0] : option;
        const nextLanguage = LANGUAGE_OPTIONS.find((item) => item.value === first?.value)?.value;
        if (nextLanguage) void setPreference("language", nextLanguage);
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
  );
}
