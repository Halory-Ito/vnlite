/**
 * 大赏的奖项行。
 *
 * 左侧是徽章（萌系的层级 / Getchu 的名次数字），标题 + 品牌居主；
 * `vnId` 匹配上了可以点进作品详情页，匹配不上的保持纯文本 ——
 * 新作还没进 VNDB 是常态，点了没反应的行不该长得像按钮。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Muted, Paragraph } from "@/components/typo";

export interface AwardRowProps {
  /** 徽章内容：层级标签（大賞 / 金賞…）或名次数字 */
  badge: string;
  /** 徽章用主题色（大賞 / 前三名），默认次级色 */
  highlight?: boolean;
  title: string;
  brand?: string;
  /** VNDB 作品 id；null 不可点 */
  vnId: string | null;
  /** 无障碍标签（默认用标题） */
  ariaLabel?: string;
}

export function AwardRow({
  badge,
  highlight = false,
  title,
  brand,
  vnId,
  ariaLabel,
}: AwardRowProps): JSX.Element {
  const router = useRouter();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const clickable = vnId != null;

  return (
    <Pressable
      onPress={clickable ? () => router.push(`/vn/${vnId}`) : undefined}
      className="flex-row items-center gap-3 px-4 py-2 active:opacity-60"
      accessibilityRole={clickable ? "button" : "text"}
      accessibilityLabel={ariaLabel ?? title}
    >
      <Paragraph className="w-14 font-semibold" style={{ color: highlight ? accent : muted }}>
        {badge}
      </Paragraph>
      <View className="flex-1 justify-center gap-0.5">
        <Paragraph numberOfLines={2}>{title}</Paragraph>
        {brand ? <Muted type="body-xs">{brand}</Muted> : null}
      </View>
      {clickable ? <Icon name="chevronRight" size={16} color={muted} /> : null}
    </Pressable>
  );
}
