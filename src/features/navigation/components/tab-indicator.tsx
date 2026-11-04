import type { JSX, ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from "react-native-reanimated";
import type { TabBarAnimation } from "@/lib/storage/preferences";
import type { TabBarStyle } from "@/lib/storage/preferences";
import { TabBarSurface } from "./tab-bar-surface";

type Selection = {
  index: number;
  count: number;
  animation: TabBarAnimation;
  style: TabBarStyle;
  opacity: number;
  blur: number;
  dark: boolean;
};

const SelectionContext = createContext<Selection>({
  index: 0,
  count: 5,
  animation: "off",
  style: "default",
  opacity: 0.78,
  blur: 0,
  dark: false,
});

export function TabIndicatorProvider({
  index,
  count,
  animation,
  style,
  opacity,
  blur,
  dark,
  children,
}: Selection & { children: ReactNode }): JSX.Element {
  const selection = useMemo(
    () => ({ index, count, animation, style, opacity, blur, dark }),
    [index, count, animation, style, opacity, blur, dark]
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
}: Selection & { barWidth: number }): JSX.Element {
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
      className="absolute top-2 h-12 rounded-full bg-segment"
      style={[{ width: indicatorWidth }, animatedStyle]}
    />
  );
}
