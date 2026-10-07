/**
 * 清空历史的二次确认。
 *
 * 走项目自己的 `AppDialog`（RN 原生 Modal 外壳），**不用系统 `Alert`** ——
 * 一是与全应用对话框外观统一，二是 Alert 在各平台样式不可控。
 */

import { Button } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Muted } from "@/components/typo";

export interface ClearHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearHistoryDialog({
  isOpen,
  onClose,
  onConfirm,
}: ClearHistoryDialogProps): JSX.Element {
  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title="清空浏览历史">
      <View className="gap-4">
        <Muted type="body-sm">会清空当前分类的全部记录，且不可撤销。</Muted>
        <View className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onPress={onClose}>
            <Button.Label>取消</Button.Label>
          </Button>
          <Button size="sm" variant="danger" onPress={onConfirm}>
            <Button.Label>清空</Button.Label>
          </Button>
        </View>
      </View>
    </AppDialog>
  );
}
