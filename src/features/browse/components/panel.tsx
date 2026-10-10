/**
 * 全屏面板外壳。
 *
 * ## 为什么不用 BottomSheet / Portal
 *
 * 见 `FilterPanel` 顶部那段：HeroUI 的 `BottomSheet.Portal` 挂载即注册到全局
 * `PortalHost`，而那一层是全屏 `absoluteFill`，关闭后仍会吃掉触摸
 * （表现为「进了浏览页就切不动 Tab」）。所以这类面板一律做成
 * **同层的全屏覆盖层**：`absolute inset-0` + `zIndex`，条件挂载，
 * 关闭时整棵子树消失，不留残留。
 *
 * 筛选面板和卡片显示面板共用这一套壳，只是内容不同。
 */

import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/hooks/use-translation";

export interface FullScreenPanelProps {
  /** 标题栏文案 */
  title: string;
  /** 无障碍标签（读屏用，一般与「打开这个面板的按钮」一致） */
  accessibilityLabel: string;
  onClose: () => void;
  /** 滚动区之上的固定内容（汇总条这类） */
  fixedHeader?: ReactNode;
  /** 滚动区内容 */
  children: ReactNode;
  /** 底部固定条 */
  footer?: ReactNode;
}

export function FullScreenPanel({
  title,
  accessibilityLabel,
  onClose,
  fixedHeader,
  children,
  footer,
}: FullScreenPanelProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <View
      className="absolute inset-0 bg-background"
      style={{ zIndex: 10 }}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
    >
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between border-b border-separator px-4 py-3">
          <Typography type="h5" className="font-semibold">
            {title}
          </Typography>
          <Pressable
            onPress={onClose}
            className="rounded-full px-3 py-1 active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel={t("common.finish")}
            hitSlop={8}
          >
            <Typography type="body-sm" className="font-semibold text-accent">
              {t("common.finish")}
            </Typography>
          </Pressable>
        </View>

        {fixedHeader ? <View className="px-4 pt-3">{fixedHeader}</View> : null}

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ gap: 20, paddingBottom: 24, paddingTop: 16 }}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>

        {footer}
      </SafeAreaView>
    </View>
  );
}
