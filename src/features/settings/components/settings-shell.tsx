/**
 * 设置类页面的外壳。
 *
 * 外观 / 内容显示 / 账号 / 关于 四个页面结构一样：返回栏 + 可滚动内容，
 * 这里统一收口，页面只管内容。
 */

import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/icon";
import { H5, Muted } from "@/components/typo";

export function SettingsShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const muted = useThemeColor("muted");

  return (
    <View className="flex-1">
      {/* 返回栏。样式对齐详情页，箭头换成内置的 Gravity UI 图标 */}
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          className="active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel="返回"
          hitSlop={8}
        >
          <Icon name="chevronLeft" size={24} color={muted} />
        </Pressable>
        <H5>{title}</H5>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        // 账号页有输入框：键盘弹着时点「登录」应该直接生效，而不是先收键盘
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * 页内小节：一行小标题 + 内容。
 *
 * 不叫 `Section` 是怕和业务里的「分区」混淆 —— 这里的语义就是设置项分组。
 */
export function SettingsSection({
  title,
  hint,
  children,
}: {
  title: string;
  /** 补充说明，只在真的能帮上忙时写 */
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <View className="gap-2 px-4 py-3">
      <Muted type="body-xs" className="font-medium">
        {title}
      </Muted>
      {children}
      {hint ? <Muted type="body-xs">{hint}</Muted> : null}
    </View>
  );
}
