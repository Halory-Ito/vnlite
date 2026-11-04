import { Tabs } from "expo-router";
import { BottomTabBar } from "expo-router/build/layouts/Tabs";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useWindowDimensions, type ColorValue } from "react-native";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icon";
import { TabButton } from "@/features/navigation/components/tab-button";
import {
  TabIndicatorBackground,
  TabIndicatorProvider,
} from "@/features/navigation/components/tab-indicator";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { resolveMode } from "@/theme/themes";

/** 栏内容高度（图标 + 文字 + 胶囊内边距），两种样式共用。 */
const TAB_BAR_CONTENT_HEIGHT = 64;

function TabIcon({ name, color }: { name: IconName; color: ColorValue }): JSX.Element {
  return <Icon name={name} size={24} color={color} />;
}

/** 底部 Tab 栏：贴底 / 悬浮胶囊。 */
export default function TabsLayout(): JSX.Element {
  const muted = useThemeColor("muted");
  const segmentForeground = useThemeColor("segment-foreground");
  const preferences = usePreferences();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const systemScheme = useColorScheme();

  const isCapsule = preferences.tabBarStyle !== "default";
  const isDark = resolveMode(preferences.colorScheme, systemScheme) === "dark";

  const capsuleWidth = Math.min(windowWidth - 24, Math.max(windowWidth * 0.84, 296), 380);
  const capsuleMargin = Math.max((windowWidth - capsuleWidth) / 2, 20);

  const barStyle = {
    position: "absolute" as const,
    bottom: isCapsule ? Math.max(insets.bottom, 12) : 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderTopColor: "transparent",
    elevation: 0,
    shadowOpacity: 0,
    paddingHorizontal: 6,
    ...(isCapsule
      ? {
          start: capsuleMargin,
          end: capsuleMargin,
          left: capsuleMargin,
          right: capsuleMargin,
          width: capsuleWidth,
          height: TAB_BAR_CONTENT_HEIGHT,
          paddingBottom: 0,
          paddingTop: 0,
          borderRadius: TAB_BAR_CONTENT_HEIGHT / 2,
          overflow: "hidden" as const,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 6,
        }
      : {
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
        }),
  };

  return (
    <Tabs
      tabBar={(props) => (
        <TabIndicatorProvider
          index={props.state.index}
          count={props.state.routes.length}
          animation={preferences.tabBarAnimation}
          style={preferences.tabBarStyle}
          opacity={preferences.tabBarOpacity}
          blur={preferences.tabBarBlur}
          dark={isDark}
        >
          <BottomTabBar {...props} />
        </TabIndicatorProvider>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: segmentForeground,
        tabBarInactiveTintColor: muted,
        tabBarLabelPosition: "below-icon",
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarBackground: () => <TabIndicatorBackground />,
        tabBarStyle: barStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color }) => <TabIcon name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.explore"),
          tabBarIcon: ({ color }) => <TabIcon name="compass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ color }) => <TabIcon name="magnifier" color={color} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: t("tabs.list"),
          tabBarIcon: ({ color }) => <TabIcon name="bookmark" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t("tabs.me"),
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
