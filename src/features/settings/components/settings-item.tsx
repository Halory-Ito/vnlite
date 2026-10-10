/**
 * 设置页的单个 item（「传统」列表行）。
 *
 * 用 HeroUI 的 `ListGroup.Item`：它自带行高、图标槽、标题/副标题排版，
 * 以及「点一下有反馈」的 Pressable 语义，比自己拿 View 拼一套省事。
 *
 * 默认右侧画「读数 + 箭头」，需要 Switch 这类控件时用 `suffix` 整个换掉。
 */

import { ListGroup, useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Muted } from "@/components/typo";

export interface SettingsItemProps {
  /** 左侧图标，取自 Gravity UI Icons（`components/icon-glyphs.ts`） */
  icon: IconName;
  label: string;
  /** 副标题，只在需要解释这一行是什么时才写 */
  description?: string;
  /** 右侧读数（当前值），如「Air · 暗」 */
  value?: string;
  /** 点击行为；不传就是纯展示行，也不会画箭头 */
  onPress?: () => void;
  /** 自定义右槽位（如 `Switch`），给了就不再画读数和箭头 */
  suffix?: ReactNode;
  /** 危险操作（清缓存之类）用红色图标提醒 */
  tone?: "default" | "danger";
  /**
   * 右侧的跳转图标，默认 `chevronRight`（应用内下一级）。
   * 跳外链时传 `arrowUpRightFromSquare` —— 右箭头会让用户以为是 App 内页面。
   */
  trailingIcon?: IconName;
}

export function SettingsItem({
  icon,
  label,
  description,
  value,
  onPress,
  suffix,
  tone = "default",
  trailingIcon = "chevronRight",
}: SettingsItemProps): JSX.Element {
  const accent = useThemeColor("accent");
  const danger = useThemeColor("danger");
  const muted = useThemeColor("muted");

  return (
    <ListGroup.Item
      onPress={onPress}
      className={onPress ? "active:opacity-60" : undefined}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <ListGroup.ItemPrefix>
        <Icon name={icon} size={20} color={tone === "danger" ? danger : accent} />
      </ListGroup.ItemPrefix>

      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
        {description ? <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>

      {suffix ?? (
        <ListGroup.ItemSuffix>
          <View className="flex-row items-center gap-1">
            {value ? <Muted type="body-sm">{value}</Muted> : null}
            {onPress ? <Icon name={trailingIcon} size={16} color={muted} /> : null}
          </View>
        </ListGroup.ItemSuffix>
      )}
    </ListGroup.Item>
  );
}
