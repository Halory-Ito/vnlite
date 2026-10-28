/** 发售日历下方的一行作品：封面 + 标题 + 评分。 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Muted, Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import { formatRating } from "@/utils/format";

export function CalendarRow({ vn }: { vn: VnSummary }): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => router.push(`/vn/${vn.id}`)}
      className="flex-row items-center gap-3 px-4 py-1.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={vn.title}
    >
      <CoverImage
        url={vn.image?.thumbnail}
        width={40}
        height={[40, 56]}
        sexual={vn.image?.sexual}
        violence={vn.image?.violence}
        accessibilityLabel={vn.title}
      />
      <View className="flex-1 gap-0.5">
        <Paragraph numberOfLines={2}>{vn.title}</Paragraph>
        <Muted type="body-xs">
          {vn.rating == null ? t("calendar.unrated") : formatRating(vn.rating)}
        </Muted>
      </View>
    </Pressable>
  );
}
