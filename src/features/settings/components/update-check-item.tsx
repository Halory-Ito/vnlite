/**
 * 「关于」页的「检查更新」行。
 *
 * 点一下查 GitHub（见 `../update-client`）：
 *   - 有更新：**自动开始下载**安装包（见 `../update-hooks`），行上显示进度
 *   - 已是最新 / 失败：行上给结果，另弹一个轻提示
 *
 * 下载进度、下载完成后的「装不装」都在 `update-card` 里，
 * 这一行只负责**状态**与**入口**。
 */

import { ListGroup, Spinner, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Linking, View } from "react-native";

import { Icon } from "@/components/icon";
import { Body } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import type { UseUpdateCheck } from "../update-hooks";

export interface UpdateCheckItemProps {
  update: UseUpdateCheck;
}

export function UpdateCheckItem({ update }: UpdateCheckItemProps): JSX.Element {
  const accent = useThemeColor("accent");
  const { t } = useTranslation();
  const { state, check, retry } = update;
  const { phase } = state;

  const busy = phase === "checking" || phase === "preparing" || phase === "downloading";
  const highlighted = phase === "available" || phase === "ready" || phase === "downloading";

  const value = ((): string => {
    switch (phase) {
      case "checking":
        return t("update.checking");
      case "latest":
        return t("update.latest");
      case "error":
        return t("update.failed");
      case "available":
        return t("update.available", { version: state.info?.version ?? "" });
      case "preparing":
        return t("update.preparing");
      case "downloading":
        return t("update.downloading", { percent: Math.round(state.progress.ratio * 100) });
      case "ready":
        return t("update.downloaded");
      case "failed":
        return t("update.downloadFailed");
      default:
        return t("update.check");
    }
  })();

  const onPress = (): void => {
    if (busy) return;
    // 有新版本但拿不到安装包（iOS / Release 没附件）→ 只能去发布页
    if (phase === "available" && state.info) {
      void Linking.openURL(state.info.url);
      return;
    }
    // 下载失败 → 重下（别又去查一遍版本）
    if (phase === "failed") {
      void retry();
      return;
    }
    // 已下载完 → 装不装由用户点卡片上的按钮决定，这里不再重复下载
    if (phase === "ready") return;
    void check();
  };

  return (
    <ListGroup.Item
      onPress={onPress}
      className="active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={t("update.check")}
    >
      <ListGroup.ItemPrefix>
        <Icon name="arrowRotateLeft" size={20} color={accent} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{t("update.check")}</ListGroup.ItemTitle>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <View className="flex-row items-center gap-1.5">
          {busy ? <Spinner size="sm" /> : null}
          <Body type="body-sm" className={highlighted ? "text-accent" : "text-muted"}>
            {value}
          </Body>
        </View>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}
