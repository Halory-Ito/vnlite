import { Label } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

export function SettingsLabel({ children }: { children: ReactNode }) {
  return (
    <Label>
      <Label.Text className="text-sm font-medium text-foreground">{children}</Label.Text>
    </Label>
  );
}

export function SettingsField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <SettingsLabel>{label}</SettingsLabel>
      {children}
    </View>
  );
}
