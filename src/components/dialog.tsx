import { useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";

import { useTranslation } from "@/hooks/use-translation";

import { Icon } from "./icon";
import { H5 } from "./typo";

export interface AppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 标题栏文案；不传就没有标题栏（内容自己处理） */
  title?: string;
  /** 是否显示并可点击关闭的全屏遮罩 */
  showBackdrop?: boolean;
  /** 读屏用的整体标签 */
  accessibilityLabel?: string;
  children: ReactNode;
}

export function AppDialog({
  isOpen,
  onClose,
  title,
  showBackdrop = true,
  accessibilityLabel,
  children,
}: AppDialogProps): JSX.Element {
  const { t } = useTranslation();
  const backdrop = useThemeColor("backdrop");
  const muted = useThemeColor("muted");
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.88, 520);
  const cardHeight = height * 0.82;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center p-5">
        {/* 遮罩：整屏可点关闭 */}
        {showBackdrop ? (
          <Pressable
            className="absolute inset-0"
            style={{ backgroundColor: backdrop }}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          />
        ) : null}

        <View
          className="overflow-hidden rounded-xl border border-border bg-background shadow-lg"
          style={{ width: cardWidth, maxHeight: cardHeight }}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel ?? title}
        >
          {title ? (
            <View className="flex-row items-center justify-between gap-3 px-4 pt-4 pb-2">
              <H5 numberOfLines={1} className="flex-1">
                {title}
              </H5>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Icon name="xmark" size={16} color={muted} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            className="px-4"
            contentContainerStyle={{ paddingBottom: title ? 16 : 20, paddingTop: title ? 0 : 20 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
