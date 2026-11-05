/**
 * 厂商 LOGO（厂商详情页头部）。
 *
 * VNDB 无厂商 LOGO，数据来自**鲲 Galgame 会社库**的构建期静态索引
 * （见 `kungal-logo.ts` 与 `scripts/sync-kungal-logos.ts`）—— 运行时零请求，
 * 查不到就不渲染（头部退回只有文字）。按 producer id 缓存。
 */

import type { JSX } from "react";
import { View } from "react-native";

import { useTranslation } from "@/hooks/use-translation";
import { ManagedImage } from "@/features/settings/components/managed-image";
import type { Producer } from "@/lib/api/types";

import { useProducerLogoUrl } from "@/features/catalog/hooks/use-kungal-logo";
import { useImageRadius } from "@/hooks/use-preferences";

/** LOGO 边长 */
const SIZE = 80;

export function ProducerLogo({ producer }: { producer: Producer }): JSX.Element | null {
  const { t } = useTranslation();
  const imageRadius = useImageRadius();
  const logoUrl = useProducerLogoUrl(producer);

  if (!logoUrl) return null;

  return (
    <View
      className="items-center justify-center overflow-hidden bg-background"
      style={{ width: SIZE, height: SIZE, borderRadius: imageRadius }}
    >
      <ManagedImage
        url={logoUrl}
        category="producer"
        style={{ width: "100%", height: "100%" }}
        contentFit="contain"
        transition={150}
        accessibilityLabel={t("catalog.logoLabel", { name: producer.name })}
      />
    </View>
  );
}
