/**
 * 「我的」。
 *
 * 传统设置页布局：**顶部是用户信息**（点头像 / 整行走账号页），
 * 下面是一串 item；主题、背景、内容显示这些具体设置都收进各自的二级页。
 *
 * 以前这一页把主题选择、背景滑杆、token 输入框、调试读数全摊在一起，
 * 首屏要滑很久才见底，且大部分是「偶尔才改一次」的东西。
 */

import { useRouter } from "expo-router";
import { ListGroup, Typography, useThemeColor, useToast } from "heroui-native";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/icon";
import { Divider } from "@/components/separator";
import { H5, Muted } from "@/components/typo";
import { SettingsItem } from "@/features/settings/components/settings-item";
import { NSFW_OPTIONS, optionLabel } from "@/features/settings/options";
import { usePreferences } from "@/hooks/use-preferences";
import { useSession } from "@/hooks/use-session";
import { clearContentCache } from "@/lib/query/client";
import { clearWalkthroughCache } from "@/features/walkthrough/cache";
import { getTheme } from "@/theme/themes";

export default function MeScreen(): JSX.Element {
  const router = useRouter();
  const preferences = usePreferences();
  const { toast } = useToast();
  // 「外观」那行的读数是主题名，同步算出来即可，不用另存状态
  const theme = getTheme(preferences.themeId);

  const clearCache = () => {
    // 内存缓存（所有业务数据）+ 攻略的落盘缓存一起清：
    // 攻略索引有 ~190KB 且带 24h TTL，只清内存的话用户会觉得「清完还在」
    void Promise.all([clearContentCache(), clearWalkthroughCache()]).then(() =>
      toast.show("已清空浏览缓存")
    );
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <ProfileHeader />

      <ListGroup className="mx-4">
        <SettingsItem
          icon="palette"
          label="外观"
          value={`${theme.name}`}
          onPress={() => router.push("/settings/appearance")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="eye"
          label="内容显示"
          value={optionLabel(NSFW_OPTIONS, preferences.nsfwMode)}
          onPress={() => router.push("/settings/content")}
        />
        <Divider className="mx-4" />

        {/* 收藏统计原来在首页的常用入口里，按 Master 要求挪进「我的」 */}
        <SettingsItem icon="chartPie" label="收藏统计" onPress={() => router.push("/stats")} />
        <Divider className="mx-4" />

        <SettingsItem icon="trashBin" label="清空浏览缓存" tone="danger" onPress={clearCache} />
        <Divider className="mx-4" />

        <SettingsItem
          icon="circleInfo"
          label="关于"
          onPress={() => router.push("/settings/about")}
        />
      </ListGroup>
    </ScrollView>
  );
}

/** 顶部用户信息。未登录时也走同一个入口去账号页登录 */
function ProfileHeader(): JSX.Element {
  const router = useRouter();
  const session = useSession();
  const accent = useThemeColor("accent");
  const muted = useThemeColor("muted");
  const account = session.status === "authenticated" ? session.account : null;
  const canWrite = account?.permissions.includes("listwrite") ?? false;

  return (
    <Pressable
      onPress={() => router.push("/settings/account")}
      className="flex-row items-center gap-3 px-4 py-4 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel="账号"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
        {account ? (
          <Typography type="h4" className="text-accent">
            {account.username.slice(0, 1).toUpperCase()}
          </Typography>
        ) : (
          <Icon name="person" size={26} color={accent} />
        )}
      </View>

      <View className="flex-1 gap-0.5">
        <H5>{account?.username ?? "未登录"}</H5>
        <Muted type="body-xs">
          {account ? `ID ${account.userId}` : "登录 VNDB 账号，启用清单同步"}
        </Muted>
        {account && !canWrite ? (
          <Muted type="body-xs" className="text-warning-soft-foreground">
            缺少 listwrite 权限，无法写入清单
          </Muted>
        ) : null}
      </View>

      <Icon name="chevronRight" size={16} color={muted} />
    </Pressable>
  );
}
