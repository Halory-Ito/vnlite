/**
 * 「我的」。
 *
 * 传统设置页布局：**顶部是用户信息**（点头像 / 整行走账号页），
 * 下面是一串 item；主题、背景、内容显示这些具体设置都收进各自的二级页。
 *
 * 文案一律走 i18n（`useTranslation`），切换语言后本页即时重渲染。
 */

import { useRouter } from "expo-router";
import { ListGroup, useToast } from "heroui-native";
import type { JSX } from "react";
import { ScrollView } from "react-native";

import { Divider } from "@/components/separator";
import { ProfileHeader } from "@/features/profile/components/profile-header";
import { SettingsItem } from "@/features/settings/components/settings-item";
import { LANGUAGE_OPTIONS, NSFW_OPTIONS, optionLabel } from "@/features/settings/options";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { clearContentCache } from "@/lib/query/client";
import { clearWalkthroughCache } from "@/features/walkthrough/cache";
import { getTheme } from "@/theme/themes";

export default function MeScreen(): JSX.Element {
  const router = useRouter();
  const preferences = usePreferences();
  const { t } = useTranslation();
  const { toast } = useToast();
  // 「外观」那行的读数是主题名，同步算出来即可，不用另存状态
  const theme = getTheme(preferences.themeId);

  const clearCache = () => {
    // 内存缓存（所有业务数据）+ 攻略的落盘缓存一起清：
    // 攻略索引有 ~190KB 且带 24h TTL，只清内存的话用户会觉得「清完还在」
    void Promise.all([clearContentCache(), clearWalkthroughCache()]).then(() =>
      toast.show(t("me.cacheCleared"))
    );
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <ProfileHeader />

      <ListGroup className="mx-4">
        <SettingsItem
          icon="palette"
          label={t("me.appearance")}
          value={theme.name}
          onPress={() => router.push("/settings/appearance")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="globe"
          label={t("settings.languageTitle")}
          value={optionLabel(LANGUAGE_OPTIONS, preferences.language, t)}
          onPress={() => router.push("/settings/language")}
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
          icon="chartPie"
          label={t("me.records")}
          onPress={() => router.push("/stats")}
        />
        <Divider className="mx-4" />

        <SettingsItem
          icon="starFill"
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
          icon="trashBin"
          label={t("me.clearCache")}
          tone="danger"
          onPress={clearCache}
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
