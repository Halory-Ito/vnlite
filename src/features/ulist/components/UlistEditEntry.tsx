/**
 * VN 详情页顶栏的清单编辑入口（状态 / 打分 / 标签 / 备注 / 日期）。
 *
 * 只在**已加入清单**时渲染：「在不在清单里」由右边的 `UlistToggleButton` 负责，
 * 我的打分由详情页的三列概览显示 —— 这里不重复任何状态，只留唯一动作（进编辑页）。
 * 位置按 Master 要求放在右上角，紧挨加入 / 移除按钮的左边。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";

import { Icon } from "@/components/Icon";
import { Muted } from "@/components/Typo";
import { usePermission } from "@/hooks/useSession";

import { useUlistItem } from "../hooks";

export function UlistEditEntry({ vnId }: { vnId: string }): JSX.Element | null {
  const router = useRouter();
  const canWrite = usePermission("listwrite");
  const item = useUlistItem(vnId, canWrite);
  const accent = useThemeColor("accent");

  if (!canWrite || !item.data) return null;

  return (
    <Pressable
      onPress={() => router.push(`/ulist/${vnId}`)}
      className="flex-row items-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-1 active:opacity-70"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="编辑清单条目（状态 / 打分 / 标签）"
    >
      {/* 图标只能吃具体色值（不吃 className），所以走主题 accent */}
      <Icon name="pencil" size={14} color={accent} />
      <Muted type="body-xs" className="font-semibold text-accent-soft-foreground">
        编辑
      </Muted>
    </Pressable>
  );
}
