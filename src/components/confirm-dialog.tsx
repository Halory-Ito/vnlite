/**
 * 危险操作二次确认对话框。
 *
 * 外壳用项目自己的 `AppDialog`（RN 原生 Modal，避开 HeroUI Dialog 的 Portal
 * 关闭后仍吃触摸的坑）；内容用 HeroUI Native 的 `Alert`（状态图标 + 标题 + 说明）。
 *
 * 取代此前各处零散的 `Alert.alert`（系统弹窗，样式不可控、与主题无关）。
 */

import { Alert, Button } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { useTranslation } from "@/hooks/use-translation";

import { AppDialog } from "./dialog";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** 确认按钮文案，默认「确定」 */
  confirmLabel?: string;
  /** 取消按钮文案，默认「取消」 */
  cancelLabel?: string;
  /** 语义状态，危险操作用 `danger`（默认） */
  status?: "danger" | "accent" | "warning";
  /** 确认操作进行中：禁用确认按钮 */
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  status = "danger",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} accessibilityLabel={title}>
      <View className="gap-4">
        <Alert status={status}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{title}</Alert.Title>
            {description ? <Alert.Description>{description}</Alert.Description> : null}
          </Alert.Content>
        </Alert>

        <View className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onPress={onClose}>
            <Button.Label>{cancelLabel ?? t("common.cancel")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant={status === "danger" ? "danger" : "primary"}
            onPress={onConfirm}
            isDisabled={isPending}
          >
            <Button.Label>{confirmLabel ?? t("common.confirm")}</Button.Label>
          </Button>
        </View>
      </View>
    </AppDialog>
  );
}
