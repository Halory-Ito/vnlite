/**
 * 全局游戏计时浮层。
 *
 * 挂在根布局（`app/_layout.tsx`）里、`Stack` 之后，所以**跨页面常驻** ——
 * 翻页 / 返回都不会重建它。
 *
 * 形态：
 *   - 默认：一个圆形，显示已计时 `HH:MM:SS`
 *   - 点圆形：额外展开「暂停 / 继续」与「结束」两个圆形按钮
 *   - **可拖动**：按住圆形拖到屏幕任意位置（会被夹在屏幕安全区内）
 *   - 暂停时圆形转中性色，一眼区分「停着」和「在走」
 *
 * 拖动用 gesture-handler 的 `Pan`，点按用 `Tap`，两者 `Race`：拖了就拖、
 * 没拖就点，互不抢。结束时通过 `finishGameTimer` 落一条游玩记录。
 *
 * 外层 `pointerEvents="box-none"`：整层不吃触摸，只有圆形与按钮可点。
 */

import { Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icon";

import { finishGameTimer } from "../actions";
import { formatGameDuration } from "../format";
import { useElapsedMs, useGameTimer } from "../hooks";
import { toggleGameTimerPause } from "../store";

/** 圆形直径 / 操作按钮直径 / 间距，以及可容纳「按钮行 + 圆形」的包裹尺寸 */
const CIRCLE = 72;
const BUTTON = 44;
const GAP = 8;
const WRAP_W = Math.max(CIRCLE, BUTTON * 2 + GAP);
const WRAP_H = CIRCLE + GAP + BUTTON;
/** 距屏幕边缘的最小留白 */
const EDGE = 8;

export function GameTimerOverlay(): JSX.Element | null {
  const timer = useGameTimer();
  const elapsed = useElapsedMs();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  // 拖动位置（绝对 left / top）。初始贴右下角、落在 Tab 栏上方
  const x = useSharedValue(width - 16 - WRAP_W);
  const y = useSharedValue(height - (insets.bottom + 60) - WRAP_H);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const minX = EDGE;
  const maxX = Math.max(EDGE, width - WRAP_W - EDGE);
  const minY = insets.top + EDGE;
  const maxY = Math.max(minY, height - insets.bottom - WRAP_H - EDGE);

  const toggleExpanded = (): void => setExpanded((value) => !value);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((event) => {
      x.value = Math.min(maxX, Math.max(minX, startX.value + event.translationX));
      y.value = Math.min(maxY, Math.max(minY, startY.value + event.translationY));
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) runOnJS(toggleExpanded)();
    });

  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({ left: x.value, top: y.value }));

  if (timer.status === "idle") return null;

  const paused = timer.status === "paused";
  const time = formatGameDuration(elapsed);

  const finish = (): void => {
    finishGameTimer();
    setExpanded(false);
  };

  return (
    <View pointerEvents="box-none" className="absolute inset-0">
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: "absolute",
            width: WRAP_W,
            height: WRAP_H,
            alignItems: "flex-end",
            justifyContent: "flex-end",
          },
          animatedStyle,
        ]}
      >
        {expanded ? (
          <View className="flex-row gap-2" style={{ marginBottom: GAP }}>
            <TimerActionButton
              icon={paused ? "play" : "pause"}
              label={paused ? "继续计时" : "暂停计时"}
              onPress={toggleGameTimerPause}
            />
            <TimerActionButton icon="stop" label="结束计时" tone="danger" onPress={finish} />
          </View>
        ) : null}

        <GestureDetector gesture={gesture}>
          <View
            className={`items-center justify-center rounded-full border border-border ${
              paused ? "bg-default-soft" : "bg-accent"
            }`}
            style={{ width: CIRCLE, height: CIRCLE }}
            accessibilityRole="button"
            accessibilityLabel={`游戏计时 ${time}${paused ? "，已暂停" : ""}`}
            accessibilityHint="点按展开暂停与结束，拖动可移动位置"
          >
            <Typography
              type="body-sm"
              selectable={false}
              style={{ fontVariant: ["tabular-nums"] }}
              className={paused ? "text-muted" : "text-accent-foreground"}
            >
              {time}
            </Typography>
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

/** 展开后的圆形操作按钮（暂停 / 继续、结束） */
function TimerActionButton({
  icon,
  label,
  onPress,
  tone = "default",
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
}): JSX.Element {
  const accent = useThemeColor("accent");
  const danger = useThemeColor("danger");

  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center rounded-full border border-border bg-background active:opacity-70"
      style={{ width: BUTTON, height: BUTTON }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={tone === "danger" ? danger : accent} />
    </Pressable>
  );
}
