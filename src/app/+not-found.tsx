import { Link } from "expo-router";
import type { JSX } from "react";
import { View } from "react-native";

import { EmptyState } from "@/components/screen-state";
import { LinkText } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

export default function NotFoundScreen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        title={t("common.notFoundTitle")}
        description={t("common.notFoundDescription")}
        action={
          <Link href="/(tabs)" className="mt-2">
            <LinkText>{t("common.goHome")}</LinkText>
          </Link>
        }
      />
    </View>
  );
}
