import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";
import { useTranslation } from "@/hooks/use-translation";

export function DiscoverRow(): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View className="mx-4 my-3 flex-row gap-2">
      <Button
        size="sm"
        variant="secondary"
        className="flex-1"
        onPress={() => router.push("/ranking")}
      >
        <Button.Label>{t("home.ranking")}</Button.Label>
      </Button>
    </View>
  );
}
