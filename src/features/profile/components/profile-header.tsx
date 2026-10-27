/**
 * 「我的」顶部用户信息。
 *
 * 左边是**可点换头像**的圆形头像（含游客态），右边整行走账号页。
 * 两者是并列的 Pressable 而不是嵌套 —— 嵌套在 Android 上很容易点穿，
 * 且无障碍焦点会叠在一起。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { H5, Muted } from "@/components/typo";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";

import { useAvatar } from "@/features/profile/hooks/use-avatar";
import { AvatarButton } from "./avatar-button";

export function ProfileHeader(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const { t } = useTranslation();
  const avatarUri = useAvatar();
  const muted = useThemeColor("muted");
  const account = session.status === "authenticated" ? session.account : null;
  const canWrite = account?.permissions.includes("listwrite") ?? false;
  const initial = account?.username.slice(0, 1).toUpperCase();

  return (
    <View className="flex-row items-center gap-3 px-4 py-4">
      <AvatarButton size={56} uri={avatarUri} initial={initial} />

      <Pressable
        onPress={() => router.push("/settings/account")}
        className="flex-1 flex-row items-center gap-3 active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel={t("settings.accountTitle")}
      >
        <View className="flex-1 gap-0.5">
          <H5>{account?.username ?? t("me.notLoggedIn")}</H5>
          <Muted type="body-xs">{account ? `ID ${account.userId}` : t("me.loginHint")}</Muted>
          {account && !canWrite ? (
            <Muted type="body-xs" className="text-warning-soft-foreground">
              {t("me.noListwrite")}
            </Muted>
          ) : null}
        </View>

        <Icon name="chevronRight" size={16} color={muted} />
      </Pressable>
    </View>
  );
}
