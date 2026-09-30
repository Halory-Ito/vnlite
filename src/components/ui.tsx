/**
 * 通用小组件：区块标题、评分徽标、标签 Chip、平台徽标、键值行、统计块。
 *
 * 配色只使用 HeroUI Native 实际提供的 token（注意没有 `muted-foreground`）。
 */

import { Chip, Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Pressable, View } from "react-native";

import {
  formatCount,
  formatRating,
  platformLabel,
  ratingTone,
  staffRoleLabel,
} from "@/utils/format";

import { H6, Muted } from "./Typo";

/* -------------------------------------------------------------------------- */
/* 区块标题                                                                    */
/* -------------------------------------------------------------------------- */

export interface SectionHeaderProps {
  title: string;
  /** 右侧插槽：数量、「查看全部」等 */
  trailing?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  trailing,
  className = "",
}: SectionHeaderProps): JSX.Element {
  return (
    <View className={`flex-row items-center justify-between px-4 py-2 ${className}`}>
      <H6>{title}</H6>
      {trailing}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 评分徽标                                                                    */
/* -------------------------------------------------------------------------- */

const RATING_TONE = {
  high: "bg-success-soft",
  mid: "bg-warning-soft",
  low: "bg-danger-soft",
  none: "bg-default-soft",
} as const;

const RATING_TEXT = {
  high: "text-success-soft-foreground",
  mid: "text-warning-soft-foreground",
  low: "text-danger-soft-foreground",
  none: "text-muted",
} as const;

export interface RatingBadgeProps {
  rating: number | null | undefined;
  votecount?: number | null;
  size?: "sm" | "md";
}

export function RatingBadge({ rating, votecount, size = "sm" }: RatingBadgeProps): JSX.Element {
  const tone = ratingTone(rating);
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full px-2 py-0.5 ${RATING_TONE[tone]}`}
    >
      <Typography type="body-xs" className={`${RATING_TEXT[tone]} font-semibold ${textSize}`}>
        {formatRating(rating)}
      </Typography>
      {votecount != null ? (
        <Typography type="body-xs" className={`${RATING_TEXT[tone]} ${textSize} opacity-60`}>
          {formatCount(votecount)}
        </Typography>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 标签                                                                        */
/* -------------------------------------------------------------------------- */

/** 标签固定色板：按 name 散列，保证同一标签每次颜色一致 */
const TAG_PALETTE = [
  "#E5395E",
  "#F57F17",
  "#2E9E4F",
  "#6C4BD8",
  "#0E9AA7",
  "#C2185B",
  "#4A47D4",
  "#E8790B",
] as const;

function tagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length] as string;
}

export interface TagChipProps {
  id: string;
  name: string;
  /** 剧透等级 0–2，>=1 时降透明度 */
  spoiler?: number;
  onPress?: (id: string) => void;
  selected?: boolean;
}

export function TagChip({ id, name, spoiler = 0, onPress, selected }: TagChipProps): JSX.Element {
  // 标签名来自 VNDB，可能带首尾空白 —— 一律 trim（芯片里折行 + 裁剪会只显示前半截）
  const label = name.trim();
  const color = tagColor(label);
  return (
    <Chip
      size="sm"
      onPress={onPress ? () => onPress(id) : undefined}
      className="shrink-0"
      style={{
        backgroundColor: selected ? color : `${color}26`,
        opacity: spoiler >= 2 ? 0.45 : spoiler === 1 ? 0.75 : 1,
      }}
    >
      <Chip.Label numberOfLines={1} style={{ color: selected ? "#FFFFFF" : color }}>
        {label}
      </Chip.Label>
    </Chip>
  );
}

/* -------------------------------------------------------------------------- */
/* 平台                                                                        */
/* -------------------------------------------------------------------------- */

export function PlatformBadges({
  platforms,
  max = 4,
}: {
  platforms: readonly string[] | undefined;
  max?: number;
}): JSX.Element | null {
  if (!platforms || platforms.length === 0) return null;
  const shown = platforms.slice(0, max);
  const rest = platforms.length - shown.length;

  return (
    <View className="flex-row flex-wrap items-center gap-1">
      {shown.map((platform) => (
        <View key={platform} className="rounded bg-default-soft px-1.5 py-0.5">
          <Muted type="body-xs" className="text-[10px]">
            {platformLabel(platform)}
          </Muted>
        </View>
      ))}
      {rest > 0 ? (
        <Muted type="body-xs" className="text-[10px]">
          +{rest}
        </Muted>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 详情页                                                                      */
/* -------------------------------------------------------------------------- */

/** 「平台：Windows · macOS」这种一行 */
export function KeyValueRow({
  label,
  children,
  onPress,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
}): JSX.Element {
  const content = (
    <View className="flex-row items-start gap-3 px-4 py-1.5">
      <Muted type="body-sm" className="w-16 shrink-0">
        {label}
      </Muted>
      <View className="flex-1 flex-row flex-wrap items-center gap-1.5">{children}</View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} className="active:opacity-60">
      {content}
    </Pressable>
  );
}

/** 详情页里 staff 职位的小标题 */
export function StaffRoleHeading({ role, count }: { role: string; count?: number }): JSX.Element {
  return (
    <View className="flex-row items-center gap-2">
      <Muted type="body-xs" className="font-medium">
        {staffRoleLabel(role)}
      </Muted>
      {count != null ? (
        <Muted type="body-xs" className="text-[10px] opacity-60">
          {count}
        </Muted>
      ) : null}
    </View>
  );
}

/** 统计页的「数字 + 说明」块 */
export function StatBlock({
  value,
  label,
  tone = "default",
}: {
  value: string | number;
  label: string;
  tone?: "default" | "accent";
}): JSX.Element {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-lg bg-default-soft py-3">
      <Muted type="h5" className={tone === "accent" ? "text-accent" : "text-foreground"}>
        {value}
      </Muted>
      <Muted type="body-xs" className="text-[10px]">
        {label}
      </Muted>
    </View>
  );
}
