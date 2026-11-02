import { Button, Card, Switch, useThemeColor, useToast } from "heroui-native";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Body } from "@/components/typo";
import {
  HOME_SECTION_LABELS,
  moveHomeSection,
  normalizeHomeLayout,
  type HomeSectionPreference,
} from "@/features/home/lib/home-layout";
import { SettingsShell } from "@/features/settings/components/settings-shell";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { setPreference } from "@/lib/storage/preferences";

export default function HomeLayoutScreen() {
  const { homeLayout } = usePreferences();
  const { t } = useTranslation();
  const color = useThemeColor("foreground");
  const surface = useTranslucentSurface();
  const { toast } = useToast();
  async function save(next: HomeSectionPreference[]) {
    try {
      await setPreference("homeLayout", next);
    } catch {
      toast.show(t("common.failed"));
    }
  }
  return (
    <SettingsShell title={t("home.layoutTitle")}>
      <View className="gap-2 px-4 py-3">
        {homeLayout.map((item, index) => {
          const label = t(HOME_SECTION_LABELS[item.id]);
          return (
            <Card key={item.id} style={surface} className="p-3">
              <Card.Body className="flex-row flex-wrap items-center justify-between gap-2">
                <Body className="min-w-24 flex-1" type="body-sm">
                  {label}
                </Body>
                <View className="flex-row items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    isDisabled={index === 0}
                    accessibilityLabel={t("home.moveUp", { name: label })}
                    onPress={() => void save(moveHomeSection(homeLayout, item.id, -1))}
                  >
                    <View className="rotate-180">
                      <Icon name="chevronDown" color={color} />
                    </View>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    isDisabled={index === homeLayout.length - 1}
                    accessibilityLabel={t("home.moveDown", { name: label })}
                    onPress={() => void save(moveHomeSection(homeLayout, item.id, 1))}
                  >
                    <Icon name="chevronDown" color={color} />
                  </Button>
                  <Switch
                    isSelected={item.visible}
                    accessibilityLabel={t("home.showSection", { name: label })}
                    onSelectedChange={(visible) =>
                      void save(
                        homeLayout.map((entry) =>
                          entry.id === item.id ? { id: entry.id, visible } : entry
                        )
                      )
                    }
                  />
                </View>
              </Card.Body>
            </Card>
          );
        })}
        <Button variant="ghost" onPress={() => void save(normalizeHomeLayout(undefined))}>
          <Button.Label>{t("home.resetLayout")}</Button.Label>
        </Button>
      </View>
    </SettingsShell>
  );
}
