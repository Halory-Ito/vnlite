import { Button, Input } from "heroui-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Muted } from "@/components/typo";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { setPreference } from "@/lib/storage/preferences";

export function DailyPlayGoal({ children }: { children: (onPress: () => void) => ReactNode }) {
  const { t } = useTranslation();
  const { dailyPlayGoalMinutes } = usePreferences();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const valid = /^\d{1,4}$/.test(value) && Number(value) >= 1 && Number(value) <= 1440;
  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await setPreference("dailyPlayGoalMinutes", Number(value));
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      {children(() => {
        setValue(String(dailyPlayGoalMinutes));
        setFailed(false);
        setOpen(true);
      })}
      <AppDialog isOpen={open} onClose={() => setOpen(false)} title={t("home.dailyGoalTitle")}>
        <View className="gap-4">
          <Input
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel={t("home.dailyGoalTitle")}
          />
          {value !== "" && !valid ? <Muted>{t("home.dailyGoalInvalid")}</Muted> : null}
          {failed ? <Muted>{t("common.failed")}</Muted> : null}
          <Button isDisabled={!valid || saving} onPress={() => void save()}>
            <Button.Label>{t("common.save")}</Button.Label>
          </Button>
        </View>
      </AppDialog>
    </>
  );
}
