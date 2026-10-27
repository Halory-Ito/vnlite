/**
 * 可点的头像：**点一下换头像**（相册 → 1:1 裁剪），右下角小铅笔标提示可编辑。
 *
 * 选图与落盘在 `../avatar`，这里只负责「点 → 选 → toast」这段交互。
 */

import { useThemeColor, useToast } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { useTranslation } from "@/hooks/use-translation";

import { pickAvatar } from "@/features/profile/lib/avatar";
import { Avatar } from "./avatar";

export interface AvatarButtonProps {
  /** 头像边长（dp） */
  size: number;
  uri: string | null;
  initial?: string | null;
}

export function AvatarButton({ size, uri, initial }: AvatarButtonProps): JSX.Element {
  const { t } = useTranslation();
  const { toast } = useToast();
  const accentForeground = useThemeColor("accent-foreground");
  const badge = Math.max(18, Math.round(size * 0.34));

  const onChange = (): void => {
    void pickAvatar().then((result) => {
      // 用户主动取消不做提示（什么都没发生）
      if (result === "saved") toast.show(t("profile.avatarSaved"));
      else if (result === "failed") toast.show(t("profile.avatarFailed"));
    });
  };

  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={t("profile.changeAvatar")}
      className="active:opacity-70"
    >
      <Avatar size={size} uri={uri} initial={initial} />
      <View
        className="absolute -right-0.5 -bottom-0.5 items-center justify-center rounded-full bg-accent"
        style={{ width: badge, height: badge }}
      >
        <Icon name="pencil" size={Math.round(badge * 0.55)} color={accentForeground} />
      </View>
    </Pressable>
  );
}
