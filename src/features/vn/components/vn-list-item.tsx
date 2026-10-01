/**
 * VN 列表行。列表页 / 搜索结果 / 标签页共用。
 *
 * 布局：竖版封面右侧信息。点击进入 `vn/[id]`。
 */

import type { JSX, ReactNode } from "react";
import { Pressable, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Muted, Paragraph } from "@/components/typo";
import { PlatformBadges, RatingBadge } from "@/components/ui";
import { usePreferences } from "@/hooks/use-preferences";
import type { VnSummary } from "@/lib/api/types";
import type { CardField } from "@/lib/storage/preferences";
import { devStatusLabel, formatLength, formatReleased, languageLabel } from "@/utils/format";

export interface VnListItemProps {
  vn: VnSummary;
  onPress?: (id: string) => void;
  /** 点封面（打开查看器用）。整行点击仍然是进详情页 */
  onCoverPress?: () => void;
  /** 右侧附加信息，如清单里的打分（M3 用） */
  trailing?: ReactNode;
  /** 卡片显示哪些信息；不传就用偏好设置里的那一份（「浏览」页面板里可调） */
  fields?: readonly CardField[];
}

export function VnListItem({
  vn,
  onPress,
  onCoverPress,
  trailing,
  fields,
}: VnListItemProps): JSX.Element {
  const preferred = usePreferences().cardFields;
  const show = (field: CardField): boolean => (fields ?? preferred).includes(field);

  const inDevelopment = vn.devstatus === 1;
  const cancelled = vn.devstatus === 2;
  const hasMeta = show("released") || (show("olang") && Boolean(vn.olang)) || show("devstatus");
  const hasStats = show("rating") || (show("length") && Boolean(vn.length));

  return (
    <Pressable
      onPress={onPress ? () => onPress(vn.id) : undefined}
      className="flex-row gap-3 px-4 py-2.5 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={vn.title}
    >
      <CoverImage
        url={vn.image?.thumbnail ?? vn.image?.url}
        width={62}
        height={[62, 82]}
        sexual={vn.image?.sexual}
        violence={vn.image?.violence}
        roundedClassName="rounded-md"
        accessibilityLabel={`${vn.title} 封面`}
        onPress={onCoverPress}
      />

      <View className="flex-1 justify-center gap-1 py-0.5">
        <Paragraph className="line-clamp-2 font-medium">{vn.title}</Paragraph>

        {hasMeta ? (
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            {show("released") ? <Muted type="body-xs">{formatReleased(vn.released)}</Muted> : null}
            {show("olang") && vn.olang ? (
              <Muted type="body-xs">{languageLabel(vn.olang)}</Muted>
            ) : null}
            {show("devstatus") && inDevelopment ? (
              <View className="rounded bg-warning-soft px-1.5 py-0.5">
                <Muted type="body-xs" className="text-warning-soft-foreground">
                  开发中
                </Muted>
              </View>
            ) : null}
            {show("devstatus") && cancelled ? (
              <View className="rounded bg-danger-soft px-1.5 py-0.5">
                <Muted type="body-xs" className="text-danger-soft-foreground">
                  {devStatusLabel(2)}
                </Muted>
              </View>
            ) : null}
          </View>
        ) : null}

        {hasStats ? (
          <View className="flex-row items-center gap-2">
            {show("rating") ? <RatingBadge rating={vn.rating} votecount={vn.votecount} /> : null}
            {show("length") && vn.length ? (
              <Muted type="body-xs">{formatLength(vn.length)}</Muted>
            ) : null}
          </View>
        ) : null}

        {show("platforms") ? <PlatformBadges platforms={vn.platforms} max={4} /> : null}
      </View>

      {trailing}
    </Pressable>
  );
}
