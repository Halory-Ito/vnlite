/**
 * 清空历史的二次确认。
 *
 * 走项目自己的 `AppDialog`（RN 原生 Modal 外壳），**不用系统 `Alert`** ——
 * 一是与全应用对话框外观统一，二是 Alert 在各平台样式不可控。
 *
 * 弹窗内可**勾选要删除的分类**（作品 / 人员 / 用户 / 厂商，多选），
 * 不勾任何一项时「清空」不可用。
 */

import { Button, Checkbox } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Body, Muted } from "@/components/typo";

import { HISTORY_TAB_OPTIONS, type HistoryTab } from "../history-constants";

export interface ClearHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 当前勾选的分类 */
  selected: HistoryTab[];
  onChange: (next: HistoryTab[]) => void;
  onConfirm: () => void;
}

export function ClearHistoryDialog({
  isOpen,
  onClose,
  selected,
  onChange,
  onConfirm,
}: ClearHistoryDialogProps): JSX.Element {
  const toggle = (tab: HistoryTab): void => {
    onChange(selected.includes(tab) ? selected.filter((t) => t !== tab) : [...selected, tab]);
  };

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title="清空浏览历史">
      <View className="gap-4">
        <Muted type="body-sm">会删除勾选分类的全部记录，且不可撤销。</Muted>

        <View className="-my-1">
          {HISTORY_TAB_OPTIONS.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <View key={option.value} className="flex-row items-center gap-2.5 py-1.5">
                <Checkbox
                  isSelected={checked}
                  onSelectedChange={() => toggle(option.value)}
                  accessibilityLabel={option.label}
                />
                {/* 整段文字也可点：避免只有小方块能命中 */}
                <Pressable
                  onPress={() => toggle(option.value)}
                  className="flex-1 active:opacity-60"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={option.label}
                >
                  <Body>{option.label}</Body>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onPress={onClose}>
            <Button.Label>取消</Button.Label>
          </Button>
          <Button size="sm" variant="danger" onPress={onConfirm} isDisabled={selected.length === 0}>
            <Button.Label>清空</Button.Label>
          </Button>
        </View>
      </View>
    </AppDialog>
  );
}
