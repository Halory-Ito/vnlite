import LottieView from "lottie-react-native";
import { useThemeColor } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  cancelAnimation,
  createAnimatedComponent,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { TAB_ICON_ANIMATIONS, type TabIconName } from "../lib/tab-icon-animations";
import { iconAnimationDuration, iconAnimationProgress } from "../lib/tab-icon-motion";

const AnimatedLottieView = createAnimatedComponent(LottieView);

export function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  const animation = TAB_ICON_ANIMATIONS[name];
  const color = useThemeColor(active ? "segment-foreground" : "muted");
  const reducedMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!loaded) return;
    cancelAnimation(progress);
    const target = active ? 1 : 0;
    const duration = iconAnimationDuration(progress.get(), target, animation.duration);
    progress.set(
      reducedMotion || duration === 0
        ? target
        : withTiming(target, {
            duration,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.System,
          })
    );
  }, [active, animation, loaded, progress, reducedMotion]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  const returnToStart = animation.returnToStart;
  const animatedProps = useAnimatedProps(() => ({
    progress: iconAnimationProgress(progress.get(), returnToStart),
  }));
  const colorFilters = useMemo(
    () => animation.source.layers.map((layer) => ({ keypath: layer.nm, color })),
    [animation, color]
  );

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-6 w-6 items-center justify-center"
    >
      <AnimatedLottieView
        animatedProps={animatedProps}
        source={animation.source}
        colorFilters={colorFilters}
        autoPlay={false}
        loop={false}
        resizeMode="contain"
        style={{ width: 32, height: 32 }}
        onAnimationLoaded={() => setLoaded(true)}
      />
    </View>
  );
}
