import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useContext } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { BlurTargetContext } from "@/features/navigation/lib/blur-target";
import { withAlpha } from "@/theme/color";
import type { TabBarStyle } from "@/lib/storage/preferences";
import { GlassHighlights } from "./glass-highlights";

const NATIVE_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

export function TabBarSurface({
  style,
  opacity,
  blur,
  glassStrength,
  dark,
}: {
  style: TabBarStyle;
  opacity: number;
  blur: number;
  glassStrength: number;
  dark: boolean;
}): JSX.Element {
  const background = useThemeColor("background");
  const target = useContext(BlurTargetContext);
  const isGlass = style === "glass";
  // Reduce milkiness at intermediate opacity; keep fully clear/opaque endpoints.
  const materialOpacity = isGlass ? opacity * (1 - 0.22 * glassStrength * (1 - opacity)) : opacity;

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      {blur > 0 && (Platform.OS !== "android" || (opacity > 0 && target?.current)) ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={blur}
          blurTarget={target ?? undefined}
          blurMethod={Platform.OS === "android" && target ? "dimezisBlurView" : "none"}
          blurReductionFactor={1}
          tint={dark ? "dark" : "light"}
        />
      ) : null}
      {isGlass && NATIVE_GLASS && opacity > 0 ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={dark ? "dark" : "light"}
          tintColor={withAlpha(background, materialOpacity)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          className="absolute inset-0"
          style={{ backgroundColor: withAlpha(background, materialOpacity) }}
        />
      )}
      {isGlass && opacity > 0 && glassStrength > 0 ? (
        <GlassHighlights dark={dark} strength={glassStrength} />
      ) : null}
    </View>
  );
}
