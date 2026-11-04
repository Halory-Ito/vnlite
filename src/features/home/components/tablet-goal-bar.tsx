import { useThemeColor } from "heroui-native";
import { Pressable, View } from "react-native";

import { Body, Muted } from "@/components/typo";
import { Icon } from "@/components/icon";

export function TabletGoalBar({
  value,
  goal,
  label,
  progressText,
  mainText,
  detailText,
  onPress,
}: {
  value: number;
  goal: number;
  label: string;
  progressText: string;
  mainText: string;
  detailText: string;
  onPress?: () => void;
}) {
  const accent = useThemeColor("accent");
  const success = useThemeColor("success");
  const track = useThemeColor("default-soft");
  const ratio = goal > 0 ? Math.min(1, Math.max(0, value) / goal) : 0;
  const achieved = goal > 0 && value >= goal;
  return (
    <Pressable
      className="w-full gap-2 py-2 active:opacity-70"
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "progressbar"}
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: goal, now: Math.min(value, goal), text: progressText }}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Body className="font-semibold">{mainText}</Body>
          {achieved ? <Icon name="check" size={18} color={success} /> : null}
        </View>
        <Muted type="body-xs" className="shrink">
          {detailText}
        </Muted>
      </View>
      <View className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: track }}>
        <View
          className="h-full rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: achieved ? success : accent }}
        />
      </View>
    </Pressable>
  );
}
