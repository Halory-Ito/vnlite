/**
 * 「我的」。
 *
 * 传统设置页布局：**顶部是用户信息**（点头像 / 整行走账号页），
 * 下面是一串 item；主题、背景、内容显示这些具体设置都收进各自的二级页。
 *
 * 文案一律走 i18n（`useTranslation`），切换语言后本页即时重渲染。
 */

import { useRouter } from "expo-router";
import { ListGroup } from "heroui-native";
import type { JSX } from "react";
import { ScrollView } from "react-native";

import { Divider } from "@/components/separator";
import { ProfileHeader } from "@/features/profile/components/profile-header";
import { useTabContentPadding } from "@/features/navigation/hooks/use-tab-content-padding";
import { SettingsItem } from "@/features/settings/components/settings-item";
import { NSFW_OPTIONS, optionLabel } from "@/features/settings/lib/options";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";
import { resolveTheme } from "@/theme/themes";

export default function MeScreen(): JSX.Element {
  const router = useRouter();
  const preferences = usePreferences();
  const { t } = useTranslation();
  const groupSurface = useTranslucentSurface();
  const bottomPadding = useTabContentPadding();
  // 「外观」那行的读数是主题名，同步算出来即可，不用另存状态
  const theme = resolveTheme(
    preferences.themeId,
    preferences.customTheme,
    t("settings.themeCustom")
  );

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: bottomPadding }}>
      <ProfileHeader />

      <ListGroup className="mx-4" style={groupSurface}>
        <SettingsItem
          icon="palette"
          label={t("me.appearance")}
          value={theme.name}
          onPress={() => router.push("/settings/appearance")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="eye"
          label={t("me.content")}
          value={optionLabel(NSFW_OPTIONS, preferences.nsfwMode, t)}
          onPress={() => router.push("/settings/content")}
        />
        <Divider className="mx-4" />

        {/* 记录统计：收藏清单 + 游玩数据的图表页 */}
        <SettingsItem
          icon="house"
          label={t("home.layoutTitle")}
          onPress={() => router.push("/settings/home-layout")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="chartPie"
          label={t("me.records")}
          onPress={() => router.push("/stats")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="star"
          label={t("me.favorites")}
          onPress={() => router.push("/favorites")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="clockArrowRotateLeft"
          label={t("me.history")}
          onPress={() => router.push("/history")}
        />
        <Divider className="mx-4" />

        {/* 同步：本地数据打包上传到 WebDAV，或从服务器下载恢复 */}
        <SettingsItem
          icon="arrowsRotateRight"
          label={t("me.sync")}
          onPress={() => router.push("/settings/sync")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="floppyDisk"
          label={t("me.clearCache")}
          onPress={() => router.push("/settings/cache")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="circleInfo"
          label={t("me.about")}
          onPress={() => router.push("/settings/about")}
        />
      </ListGroup>
    </ScrollView>
  );
}
