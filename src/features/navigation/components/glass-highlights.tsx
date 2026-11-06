import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { withAlpha } from "@/theme/color";

/** Static reflections shared by the capsule and its moving selection. */
export function GlassHighlights({ dark, strength }: { dark: boolean; strength: number }) {
  const id = useId().replace(/:/g, "");
  const alpha = (value: number) => Math.min(1, value * strength);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      className="absolute inset-0 overflow-hidden rounded-full"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="35%" y2="100%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={alpha(dark ? 0.18 : 0.38)} />
            <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={alpha(0.03)} />
            <Stop offset="0.65" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={alpha(dark ? 0.07 : 0.16)} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <View
        className="absolute inset-0 rounded-full border"
        style={{
          borderColor: withAlpha(dark ? "#FFFFFF" : "#000000", alpha((dark ? 36 : 18) / 255)),
        }}
      />
      <View
        className="absolute inset-px rounded-full border"
        style={{
          borderColor: withAlpha(dark ? "#000000" : "#FFFFFF", alpha((dark ? 36 : 56) / 255)),
        }}
      />
    </View>
  );
}
