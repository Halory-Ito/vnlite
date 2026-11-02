import { useThemeColor } from "heroui-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Icon } from "@/components/icon";
import { useTranslation } from "@/hooks/use-translation";

const SIZE = 176;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** SVG 随卡片宽度缩放，窄屏两列不会溢出。 */
export function GoalProgressRing({
  value,
  goal,
  label,
  text,
  children,
  onPress,
}: {
  value: number;
  goal: number;
  label: string;
  text: string;
  children: ReactNode;
  onPress?: () => void;
}) {
  const accent = useThemeColor("accent");
  const success = useThemeColor("success");
  const track = useThemeColor("default-soft");
  const { t } = useTranslation();
  const current = Math.max(0, value);
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const achieved = goal > 0 && current >= goal;
  return (
    <Pressable
      className="w-full items-center py-1 active:opacity-70"
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : "progressbar"}
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: goal,
        now: Math.min(current, goal),
        text: achieved ? `${text}，${t("home.goalReached")}` : text,
      }}
    >
      <View className="aspect-square w-full max-w-28 items-center justify-center">
        <View className="absolute inset-0" pointerEvents="none" accessible={false}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} accessible={false}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={track}
              strokeWidth={STROKE}
            />
            {ratio > 0 ? (
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={achieved ? success : accent}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
                rotation={-90}
                origin={`${SIZE / 2}, ${SIZE / 2}`}
              />
            ) : null}
          </Svg>
        </View>
        <View className="w-3/4 items-center gap-1">
          {achieved ? <Icon name="check" size={40} color={success} /> : children}
        </View>
      </View>
    </Pressable>
  );
}
