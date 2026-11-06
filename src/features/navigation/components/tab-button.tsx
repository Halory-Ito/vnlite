import type { JSX } from "react";
import { Pressable, View } from "react-native";
import type { BottomTabBarButtonProps } from "expo-router/build/layouts/Tabs";
import type { TabIconName } from "../lib/tab-icon-animations";
import { TabIcon } from "./tab-icon";

export function TabButton({
  children,
  icon,
  style: _style,
  ...props
}: BottomTabBarButtonProps & { icon: TabIconName }): JSX.Element {
  const focused = props["aria-selected"] === true;

  return (
    <Pressable
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      testID={props.testID}
      role={props.role}
      aria-label={props["aria-label"]}
      aria-selected={focused}
      accessibilityLargeContentTitle={props.accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={props.accessibilityShowsLargeContentViewer}
      disabled={props.disabled}
      className="flex-1 items-center justify-center px-0.5"
    >
      <View className="h-12 w-full max-w-[68px] items-center justify-center">
        <View className="h-7 w-8 items-center justify-center">
          <TabIcon name={icon} active={focused} />
        </View>
        {children}
      </View>
    </Pressable>
  );
}
