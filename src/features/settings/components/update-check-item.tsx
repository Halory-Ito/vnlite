/**
 * 「关于」页的「检查更新」行。
 *
 * 点按查询 GitHub（见 `../update-client`）：
 *   - 有更新：行上显示「发现 vX.Y.Z」，并弹出对话框引导去发布页
 *   - 已是最新 / 失败：行上给结果，另弹一个轻提示
 *
 * 有更新时再点这一行直接打开发布页（不再重复查询）。
 */

import { Button, ListGroup, Spinner, useThemeColor, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Linking, View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Icon } from "@/components/icon";
import { Body, Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { isNewerVersion } from "../update-check";
import { fetchLatestRelease, type UpdateInfo } from "../update-client";

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "latest" }
  | { status: "error" }
  | { status: "available"; info: UpdateInfo };

export function UpdateCheckItem({ currentVersion }: { currentVersion: string }): JSX.Element {
  const accent = useThemeColor("accent");
  const { t } = useTranslation();
  const { toast } = useToast();
  const [state, setState] = useState<CheckState>({ status: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);

  const check = async (): Promise<void> => {
    if (state.status === "checking") return;
    setState({ status: "checking" });
    try {
      const latest = await fetchLatestRelease();
      if (latest && isNewerVersion(latest.version, currentVersion)) {
        setState({ status: "available", info: latest });
        setDialogOpen(true);
      } else {
        setState({ status: "latest" });
        toast.show(t("update.latestToast"));
      }
    } catch {
      setState({ status: "error" });
      toast.show(t("update.failedToast"));
    }
  };

  const onPress = (): void => {
    if (state.status === "available") {
      void Linking.openURL(state.info.url);
      return;
    }
    void check();
  };

  const available = state.status === "available";
  const value = available
    ? t("update.available", { version: state.info.version })
    : state.status === "checking"
      ? t("update.checking")
      : state.status === "latest"
        ? t("update.latest")
        : state.status === "error"
          ? t("update.failed")
          : t("update.check");

  return (
    <>
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
            {state.status === "checking" ? <Spinner size="sm" /> : null}
            <Body type="body-sm" className={available ? "text-accent" : "text-muted"}>
              {value}
            </Body>
          </View>
        </ListGroup.ItemSuffix>
      </ListGroup.Item>

      <AppDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t("update.dialogTitle")}
      >
        <View className="gap-4">
          <Muted type="body-sm">
            {t("update.dialogBody", {
              current: currentVersion,
              latest: available ? state.info.version : "",
            })}
          </Muted>
          <View className="flex-row justify-end gap-2">
            <Button size="sm" variant="ghost" onPress={() => setDialogOpen(false)}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button
              size="sm"
              onPress={() => {
                if (available) void Linking.openURL(state.info.url);
                setDialogOpen(false);
              }}
            >
              <Button.Label>{t("update.goDownload")}</Button.Label>
            </Button>
          </View>
        </View>
      </AppDialog>
    </>
  );
}
