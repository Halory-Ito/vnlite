import type { JSX } from "react";
import { Pressable, View } from "react-native";
import type { BottomTabBarButtonProps } from "expo-router/build/layouts/Tabs";

export function TabButton({
  children,
  style: _style,
  ...props
}: BottomTabBarButtonProps): JSX.Element {
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
      <View className="h-12 w-full max-w-[68px] items-center justify-center">{children}</View>
    </Pressable>
  );
}
