import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { usePreferences } from "@/hooks/usePreferences";
import { withAlpha } from "@/theme/color";

/**
 * Tab 栏底色的最低不透明度。
 * 0.72 是试出来的下限：再透背景图就会看不清选中态文字。
 */
const TAB_BAR_MIN_ALPHA = 0.72;

function TabIcon({ name, color }: { name: IconName; color: ColorValue }): JSX.Element {
  return <Icon name={name} size={24} color={color} />;
}

/**
 * 底部 Tab 栏。
 *
 * ⚠️ 这里的颜色**必须显式传**，不能指望主题自动生效：
 * 底部 Tab 栏是 react-navigation 渲染的，它读的是 `NavigationContainer`
 * 的 theme，跟 Uniwind/HeroUI 的 CSS 变量是两套体系。
 * 不传的话永远是默认的蓝底白字，换主题时这里不会跟着变。
 *
 * ## 选中态为什么这样画
 *
 * 之前是「整格铺一层 `surface` 50% 色块」—— 看上去像一块糊上去的灰板，
 * 四个角还是方的，跟圆角 UI 完全不搭，Master 直接否了。
 *
 * 现在改成**选中块 + 品牌色图标**：
 *   - 底色用 `--segment`，也就是 `Tabs` / `SegmentedControl` 选中态用的同一套色阶，
 *     全 App 的「选中」语言统一
 *   - 图标与文字用 `--segment-foreground`（派生为品牌 accent），一眼看出选中的是哪个
 *
 * 底色用 `withAlpha(background, …)` 而不是纯色：不透明的话这条栏
 * 会把背景图拦腰截断，看上去像「只有列表页有背景图」。
 */
export default function TabsLayout(): JSX.Element {
  const background = useThemeColor("background");
  const muted = useThemeColor("muted");
  const segment = useThemeColor("segment");
  const segmentForeground = useThemeColor("segment-foreground");
  const maskOpacity = usePreferences().backgroundOpacity;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /*
         * ⚠️ `sceneStyle` 必须显式给 `transparent`，否则背景图看不见。
         *
         * expo-router 内部每个 Tab 场景都包了一层 `<Background>`，它把
         * `backgroundColor: colors.background` 放在 style 数组的**第一项**
         * （`expo-router/build/react-navigation/elements/Background.js`），
         * 而那个 `colors` 来自 expo-router 自己的主题，跟我们的
         * Uniwind / HeroUI 变量完全是两套体系 —— 不覆盖的话每个 Tab 都会被
         * 刷成一层不透明底色，把 `ThemeProvider` 铺在最底层的背景图盖死。
         *
         * 之所以覆盖得住：style 数组里**靠后**的项赢，
         * 而 `sceneStyle` 正好被拼在默认底色之后。
         *
         * 同理，`Stack` 的 `contentStyle` 也必须给 `transparent`（见 `_layout.tsx`）。
         */
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: segmentForeground,
        tabBarInactiveTintColor: muted,
        tabBarActiveBackgroundColor: segment,
        tabBarInactiveBackgroundColor: "transparent",
        tabBarStyle: {
          backgroundColor: withAlpha(
            background,
            TAB_BAR_MIN_ALPHA + maskOpacity * (1 - TAB_BAR_MIN_ALPHA)
          ),
          borderTopColor: "transparent",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color }) => <TabIcon name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "浏览",
          tabBarIcon: ({ color }) => <TabIcon name="compass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "搜索",
          tabBarIcon: ({ color }) => <TabIcon name="magnifier" color={color} />,
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: "清单",
          tabBarIcon: ({ color }) => <TabIcon name="bookmark" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
