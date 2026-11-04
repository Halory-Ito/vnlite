import type { JSX } from "react";
import { View } from "react-native";

import { Muted, Paragraph } from "@/components/typo";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import { getVnDisplayTitle, getVnOriginalTitle } from "@/features/vn/lib/display-title";

export function VnDisplayTitle({
  vn,
  className,
  numberOfLines,
  original,
}: {
  vn: VnSummary;
  className?: string;
  numberOfLines?: number;
  original?: string;
}): JSX.Element {
  const { locale } = useTranslation();
  const preferences = usePreferences();
  const title = getVnDisplayTitle(vn, locale === "zh");
  const originalTitle = preferences.showVnOriginalTitle
    ? (original ?? getVnOriginalTitle(vn))
    : undefined;
  const showOriginal = originalTitle && originalTitle !== title;

  return (
    <View className="min-w-0">
      <Paragraph className={className} numberOfLines={numberOfLines}>
        {title}
      </Paragraph>
      {showOriginal ? (
        <Muted type="body-xs" numberOfLines={1}>
          {originalTitle}
        </Muted>
      ) : null}
    </View>
  );
}
