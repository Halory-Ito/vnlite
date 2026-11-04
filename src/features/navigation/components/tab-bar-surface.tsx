import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useContext } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { BlurTargetContext } from "@/features/navigation/lib/blur-target";
import { withAlpha } from "@/theme/color";
import type { TabBarStyle } from "@/lib/storage/preferences";

const NATIVE_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

export function TabBarSurface({
  style,
  opacity,
  blur,
  dark,
}: {
  style: TabBarStyle;
  opacity: number;
  blur: number;
  dark: boolean;
}): JSX.Element {
  const background = useThemeColor("background");
  const target = useContext(BlurTargetContext);
  const isGlass = style === "glass";

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      {blur > 0 && (Platform.OS !== "android" || opacity > 0) ? (
        <BlurView
          style={[StyleSheet.absoluteFill, { opacity: Platform.OS === "android" ? opacity : 1 }]}
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
          tintColor={withAlpha(background, opacity)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          className="absolute inset-0"
          style={{ backgroundColor: withAlpha(background, opacity) }}
        />
      )}
      {isGlass ? (
        <View
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: withAlpha(dark ? "#FFFFFF" : "#000000", 0.18) }}
        />
      ) : null}
    </View>
  );
}
