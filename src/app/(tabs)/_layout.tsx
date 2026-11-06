import { Tabs } from "expo-router";
import { BottomTabBar } from "expo-router/build/layouts/Tabs";
import { useCallback, useContext, useState, type ComponentRef, type RefObject } from "react";
import { View } from "react-native";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useWindowDimensions } from "react-native";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabButton } from "@/features/navigation/components/tab-button";
import { TabBlurTarget } from "@/features/navigation/components/tab-blur-target";
import { BlurTargetContext } from "@/features/navigation/lib/blur-target";
import {
  TabIndicatorBackground,
  TabIndicatorProvider,
} from "@/features/navigation/components/tab-indicator";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { resolveMode } from "@/theme/themes";

/** 栏内容高度（图标 + 文字 + 胶囊内边距），两种样式共用。 */
const TAB_BAR_CONTENT_HEIGHT = 64;

/** 底部 Tab 栏：贴底 / 悬浮胶囊。 */
export default function TabsLayout(): JSX.Element {
  const backgroundTarget = useContext(BlurTargetContext);
  const [targets, setTargets] = useState<
    Record<string, RefObject<ComponentRef<typeof View> | null>>
  >({});
  const registerTarget = useCallback((key: string, target: ComponentRef<typeof View> | null) => {
    // Publish a new ref object so BlurView notices targets mounted after the bar.
    setTargets((current) =>
      current[key]?.current === target ? current : { ...current, [key]: { current: target } }
    );
  }, []);
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
        }
      : {
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
        }),
  };

  return (
    <Tabs
      screenLayout={({ children, route }) => (
        <TabBlurTarget
          routeKey={route.key}
          onTarget={registerTarget}
          includeBackground={!isCapsule}
        >
          {children}
        </TabBlurTarget>
      )}
      tabBar={(props) => (
        <BlurTargetContext.Provider
          value={
            isCapsule
              ? backgroundTarget
              : targets[props.state.routes[props.state.index]!.key]?.current
                ? targets[props.state.routes[props.state.index]!.key]!
                : backgroundTarget
          }
        >
          <TabIndicatorProvider
            index={props.state.index}
            count={props.state.routes.length}
            animation={preferences.tabBarAnimation}
            style={preferences.tabBarStyle}
            opacity={preferences.tabBarOpacity}
            blur={preferences.tabBarBlur}
            glassStrength={preferences.tabBarGlassStrength}
            dark={isDark}
          >
            <BottomTabBar {...props} />
          </TabIndicatorProvider>
        </BlurTargetContext.Provider>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: segmentForeground,
        tabBarInactiveTintColor: muted,
        tabBarLabelPosition: "below-icon",
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        // The persistent icon lives in TabButton so its exit animation remains visible.
        tabBarIcon: () => null,
        tabBarIconStyle: { display: "none" },
        tabBarBackground: () => <TabIndicatorBackground />,
        tabBarStyle: barStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarButton: (props) => <TabButton {...props} icon="house" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.explore"),
          tabBarButton: (props) => <TabButton {...props} icon="compass" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          tabBarButton: (props) => <TabButton {...props} icon="magnifier" />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: t("tabs.list"),
          tabBarButton: (props) => <TabButton {...props} icon="bookmark" />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t("tabs.me"),
          tabBarButton: (props) => <TabButton {...props} icon="person" />,
        }}
      />
    </Tabs>
  );
}
