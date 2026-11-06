import type { JSX, ReactNode } from "react";
import { useThemeColor } from "heroui-native";
import { createContext, useContext, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from "react-native-reanimated";
import type { TabBarAnimation } from "@/lib/storage/preferences";
import type { TabBarStyle } from "@/lib/storage/preferences";
import { TabBarSurface } from "./tab-bar-surface";
import { GlassHighlights } from "./glass-highlights";
import { withAlpha } from "@/theme/color";

type Selection = {
  index: number;
  count: number;
  animation: TabBarAnimation;
  style: TabBarStyle;
  opacity: number;
  blur: number;
  glassStrength: number;
  dark: boolean;
};

const SelectionContext = createContext<Selection>({
  index: 0,
  count: 5,
  animation: "off",
  style: "default",
  opacity: 0.78,
  blur: 0,
  glassStrength: 1,
  dark: false,
});

export function TabIndicatorProvider({
  index,
  count,
  animation,
  style,
  opacity,
  blur,
  glassStrength,
  dark,
  children,
}: Selection & { children: ReactNode }): JSX.Element {
  const selection = useMemo(
    () => ({ index, count, animation, style, opacity, blur, glassStrength, dark }),
    [index, count, animation, style, opacity, blur, glassStrength, dark]
  );
  return <SelectionContext.Provider value={selection}>{children}</SelectionContext.Provider>;
}

export function TabIndicatorBackground(): JSX.Element {
  const selection = useContext(SelectionContext);
  const [width, setWidth] = useState(0);

  return (
    <View
      pointerEvents="none"
      className="flex-1"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <TabBarSurface
        style={selection.style}
        opacity={selection.opacity}
        blur={selection.blur}
        glassStrength={selection.glassStrength}
        dark={selection.dark}
      />
      {width > 0 ? <MovingIndicator {...selection} barWidth={width} /> : null}
    </View>
  );
}

function MovingIndicator({
  index,
  count,
  animation,
  barWidth,
  glassStrength,
  style,
  dark,
  opacity,
}: Selection & { barWidth: number }): JSX.Element {
  const segment = useThemeColor("segment");
  const isGlass = style === "glass";
  const itemWidth = (barWidth - 12) / count;
  const indicatorWidth = Math.min(itemWidth - 4, 68);
  const target = 6 + itemWidth * (index + 0.5);
  const front = useDerivedValue(
    () =>
      animation === "off"
        ? target
        : animation === "bounce"
          ? withSpring(target, { stiffness: 480, damping: 27 })
          : withSpring(target, { mass: 1, stiffness: 480, damping: 46, overshootClamping: true }),
    [animation, target]
  );
  const back = useDerivedValue(
    () =>
      animation === "off"
        ? target
        : animation === "bounce"
          ? withSpring(target, { stiffness: 280, damping: 20 })
          : withSpring(target, { mass: 1, stiffness: 280, damping: 36, overshootClamping: true }),
    [animation, target]
  );
  const animatedStyle = useAnimatedStyle(() => {
    const gap = Math.min(Math.abs(front.value - back.value) * 0.35, 20);
    return {
      left: (front.value + back.value) / 2 - indicatorWidth / 2,
      width: indicatorWidth + gap,
      transform: [{ translateX: -gap / 2 }],
    };
  });

  return (
    <Animated.View
      className="absolute top-2 h-12 overflow-hidden rounded-full"
      style={[
        {
          width: indicatorWidth,
          backgroundColor: isGlass
            ? withAlpha(segment, 1 - (dark ? 0.28 : 0.2) * Math.min(glassStrength, 2))
            : segment,
        },
        animatedStyle,
      ]}
    >
      {isGlass && opacity > 0 && glassStrength > 0 ? (
        <GlassHighlights dark={dark} strength={glassStrength} />
      ) : null}
    </Animated.View>
  );
}
