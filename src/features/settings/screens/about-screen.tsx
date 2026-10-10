/**
 * 关于页：版本 / 检查更新 / 开发者信息 / 数据与致谢。
 *
 * 版本号取 `app.json`，不手写 —— 免得改了配置忘了这里。
 * 「检查更新」查 GitHub 最新 Release（见 features/settings/update-client）。
 */

import Constants from "expo-constants";
import { ListGroup } from "heroui-native";
import type { JSX } from "react";
import { Linking, View } from "react-native";

import { Divider } from "@/components/separator";
import { Muted } from "@/components/typo";
import { DEVELOPER_INFO } from "@/constants/config";
import { SettingsItem } from "@/features/settings/components/settings-item";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { UpdateCheckItem } from "@/features/settings/components/update-check-item";
import { useTranslation } from "@/hooks/use-translation";

const VERSION = Constants.expoConfig?.version ?? "1.0.0";
const REPO_URL = `https://github.com/${DEVELOPER_INFO.repo}`;

export default function AboutScreen(): JSX.Element {
  const { t } = useTranslation();

  return (
    <SettingsShell title={t("settings.aboutTitle")}>
      <ListGroup className="mx-4">
        <SettingsItem icon="circleInfo" label={t("settings.version")} value={VERSION} />
        <Divider className="mx-4" />
        <UpdateCheckItem currentVersion={VERSION} />
      </ListGroup>

      <SettingsSection title={t("settings.developerSection")}>
        <ListGroup>
          <SettingsItem
            icon="person"
            label={t("settings.developer")}
            value={DEVELOPER_INFO.name}
            trailingIcon="arrowUpRightFromSquare"
            onPress={() => void Linking.openURL(DEVELOPER_INFO.github)}
          />
          <Divider className="mx-4" />
          <SettingsItem
            icon="folderOpen"
            label={t("settings.repo")}
            trailingIcon="arrowUpRightFromSquare"
            onPress={() => void Linking.openURL(REPO_URL)}
          />
          <Divider className="mx-4" />
          <SettingsItem
            icon="triangleExclamation"
            label={t("settings.issues")}
            trailingIcon="arrowUpRightFromSquare"
            onPress={() => void Linking.openURL(DEVELOPER_INFO.issues)}
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title={t("settings.dataSection")}>
        <ListGroup>
          <SettingsItem icon="star" label={t("settings.dataSource")} value="VNDB Kana API" />
          <Divider className="mx-4" />
          <SettingsItem
            icon="route"
            label={t("settings.walkthroughRepo")}
            trailingIcon="arrowUpRightFromSquare"
            onPress={() => void Linking.openURL(DEVELOPER_INFO.walkthroughRepo)}
          />
          <Divider className="mx-4" />
          <SettingsItem icon="palette" label={t("settings.icons")} value="Gravity UI Icons" />
          <Divider className="mx-4" />
          <SettingsItem
            icon="star"
            label={t("settings.producerLogo")}
            value="鲲 Galgame"
            trailingIcon="arrowUpRightFromSquare"
            onPress={() => void Linking.openURL("https://www.kungal.com/galgame/official")}
          />
        </ListGroup>
      </SettingsSection>

      <View className="px-4 py-3">
        <Muted type="body-xs">{t("settings.disclaimer")}</Muted>
      </View>
    </SettingsShell>
  );
}
