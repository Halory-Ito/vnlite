/**
 * 「检查更新」的卡片：新版本信息 + 下载进度 + 装不装的决定权。
 *
 * ## 交互
 *
 * - **发现新版本** → 自动开始下载（不用点）
 * - **下载中** → 进度条 + 「取消」
 * - **下载完成** → 弹窗问「现在装吗」；选「稍后」就留在卡片上，随时能装
 * - **失败** → 「重试」/「打开发布页」
 *
 * 卡片只在有内容时出现（idle / checking / latest / error 都不显示）。
 */

import { Button, Card, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Linking, View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Icon } from "@/components/icon";
import { Muted } from "@/components/typo";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";
import { formatBytes } from "@/utils/format";

import type { UseUpdateCheck } from "../update-hooks";

export interface UpdateCardProps {
  update: UseUpdateCheck;
}

const VISIBLE_PHASES = new Set(["available", "preparing", "downloading", "ready", "failed"]);

export function UpdateCard({ update }: UpdateCardProps): JSX.Element | null {
  const { t } = useTranslation();
  const accent = useThemeColor("accent");
  const danger = useThemeColor("danger");
  const surface = useTranslucentSurface();
  const { state, install, cancel, retry, dismiss } = update;
  const { phase } = state;
  /**
   * 「装不装」弹窗：**由阶段推导**，不用 effect 改 state。
   *
   * 记的是「用户对哪个版本说过稍后」—— 换个版本就重新弹，
   * 同一个版本再点「安装」不会又被弹窗拦一次。
   */
  const [declinedVersion, setDeclinedVersion] = useState<string | null>(null);

  const version = state.info?.version ?? "";
  const dialogOpen = phase === "ready" && declinedVersion !== version;

  if (!VISIBLE_PHASES.has(phase)) return null;

  const size = formatBytes(state.asset?.size);
  const percent = Math.round(state.progress.ratio * 100);
  const downloading = phase === "preparing" || phase === "downloading";

  const title = t("update.available", { version });
  const description =
    phase === "failed"
      ? (state.error ?? t("update.downloadFailed"))
      : size
        ? t("update.size", { size })
        : t("update.noPackage");

  return (
    <>
      <View className="mx-4 mt-2">
        <Card style={surface}>
          <Card.Header className="flex-row items-center gap-2">
            <Icon
              name={phase === "failed" ? "triangleExclamation" : "box"}
              size={20}
              color={phase === "failed" ? danger : accent}
            />
            <View className="flex-1">
              <Card.Title>{title}</Card.Title>
              <Card.Description numberOfLines={2}>{description}</Card.Description>
            </View>
          </Card.Header>

          {downloading ? (
            <Card.Body className="gap-1.5">
              <View className="h-1.5 w-full overflow-hidden rounded-full bg-default-soft">
                <View className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
              </View>
              <Muted type="body-xs">
                {phase === "preparing"
                  ? t("update.preparing")
                  : t("update.downloading", { percent })}
              </Muted>
            </Card.Body>
          ) : null}

          <Card.Footer className="flex-row justify-end gap-2">
            {downloading ? (
              <Button size="sm" variant="ghost" onPress={cancel}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
            ) : null}

            {phase === "ready" ? (
              <>
                <Button size="sm" variant="ghost" onPress={dismiss}>
                  <Button.Label>{t("common.close")}</Button.Label>
                </Button>
                <Button
                  size="sm"
                  onPress={() => {
                    void install();
                  }}
                >
                  <Button.Label>{t("update.install")}</Button.Label>
                </Button>
              </>
            ) : null}

            {phase === "failed" ? (
              <>
                <Button size="sm" variant="ghost" onPress={dismiss}>
                  <Button.Label>{t("common.close")}</Button.Label>
                </Button>
                <Button size="sm" variant="ghost" onPress={() => void retry()}>
                  <Button.Label>{t("common.retry")}</Button.Label>
                </Button>
              </>
            ) : null}

            {phase === "available" || phase === "failed" ? (
              <Button
                size="sm"
                onPress={() => {
                  if (state.info) void Linking.openURL(state.info.url);
                }}
              >
                <Button.Label>{t("update.releasePage")}</Button.Label>
              </Button>
            ) : null}
          </Card.Footer>
        </Card>
      </View>

      <AppDialog
        isOpen={dialogOpen}
        onClose={() => setDeclinedVersion(version)}
        title={t("update.downloadDoneTitle")}
      >
        <View className="gap-4">
          <Muted type="body-sm">{t("update.downloadDoneBody")}</Muted>
          <View className="flex-row justify-end gap-2">
            <Button size="sm" variant="ghost" onPress={() => setDeclinedVersion(version)}>
              <Button.Label>{t("update.installLater")}</Button.Label>
            </Button>
            <Button
              size="sm"
              onPress={() => {
                setDeclinedVersion(version);
                void install();
              }}
            >
              <Button.Label>{t("update.installNow")}</Button.Label>
            </Button>
          </View>
        </View>
      </AppDialog>
    </>
  );
}
