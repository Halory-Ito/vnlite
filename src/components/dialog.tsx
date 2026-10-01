/**
 * 对话框外壳（居中卡片 + 背景遮罩）。
 *
 * ## 为什么不用 HeroUI 的 `Dialog.Portal`
 *
 * 与 `features/browse/components/panel.tsx` 同一个坑：HeroUI 的 Portal 会注册到
 * 全局 `PortalHost`，而那一层是全屏 `absoluteFill`，关闭后仍会吃掉触摸
 * （表现为「进了这个页就切不动 Tab」）。所以对话框一律走 **React Native 原生
 * `Modal`** —— 原生 Modal 不依赖那个 PortalHost，`ImageViewer` 早就这么用了。
 *
 * 尺寸：横向最多 88% 屏宽、纵向最多 82% 屏高，内容超出就在内部滚
 * （评价正文可能几千字，不给滚动就会被裁掉）。
 *
 * 遮罩色取主题 `backdrop` token（HeroUI 有这个色，深浅色下不同），
 * 别写死 `rgba(0,0,0,0.5)` —— 浅色主题下会显得脏。
 */

import { useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";

import { Icon } from "./icon";
import { H5 } from "./typo";

export interface AppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 标题栏文案；不传就没有标题栏（内容自己处理） */
  title?: string;
  /** 读屏用的整体标签 */
  accessibilityLabel?: string;
  children: ReactNode;
}

export function AppDialog({
  isOpen,
  onClose,
  title,
  accessibilityLabel,
  children,
}: AppDialogProps): JSX.Element {
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
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: backdrop }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="关闭"
        />

        <View
          className="overflow-hidden rounded-xl bg-background"
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
                accessibilityLabel="关闭"
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
