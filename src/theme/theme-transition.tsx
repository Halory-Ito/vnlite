import { useLayoutEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function ThemeTransition({
  changeKey,
  backgroundColor,
  children,
}: {
  changeKey: string;
  backgroundColor: string;
  children: ReactNode;
}) {
  const previousKey = useRef(changeKey);
  const opacity = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (previousKey.current === changeKey) return;
    previousKey.current = changeKey;
    cancelAnimation(opacity);
    if (reducedMotion) {
      opacity.set(0);
      return;
    }

    // Animate only a decorative layer, rather than compositing the entire app.
    opacity.set(0.18);
    opacity.set(
      withTiming(0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      })
    );
    return () => cancelAnimation(opacity);
  }, [changeKey, opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      {children}
      <Animated.View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute inset-0"
        style={[{ backgroundColor }, animatedStyle]}
      />
    </View>
  );
}
