/**
 * 「清空某类本地数据」的二次确认对话框（浏览历史 / 收藏共用）。
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

import { useTranslation } from "@/hooks/use-translation";

import { AppDialog } from "./dialog";
import { Body, Muted } from "./typo";

export interface ClearCategoryOption<T extends string> {
  value: T;
  label: string;
}

export interface ClearCategoriesDialogProps<T extends string> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** 说明文案（会删除什么、是否可撤销） */
  description: string;
  /** 可勾选的分类（顺序即展示顺序） */
  options: ClearCategoryOption<T>[];
  /** 当前勾选的分类 */
  selected: T[];
  onChange: (next: T[]) => void;
  onConfirm: () => void;
}

export function ClearCategoriesDialog<T extends string>({
  isOpen,
  onClose,
  title,
  description,
  options,
  selected,
  onChange,
  onConfirm,
}: ClearCategoriesDialogProps<T>): JSX.Element {
  const { t } = useTranslation();
  const toggle = (value: T): void => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title={title}>
      <View className="gap-4">
        <Muted type="body-sm">{description}</Muted>

        <View className="-my-1">
          {options.map((option) => {
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
            <Button.Label>{t("common.cancel")}</Button.Label>
          </Button>
          <Button size="sm" variant="danger" onPress={onConfirm} isDisabled={selected.length === 0}>
            <Button.Label>{t("common.clear")}</Button.Label>
          </Button>
        </View>
      </View>
    </AppDialog>
  );
}
