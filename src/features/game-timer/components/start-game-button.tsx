/**
 * VN 详情页的计时按钮。
 *
 * 全局同时只有一个计时器，按钮据此反映当前状态：
 *   - 空闲 → 「开始游戏」，点击开始计这个作品
 *   - **正在计这个作品 → 同一行两个按钮「暂停」「结束」**
 *   - **这个作品已暂停 → 同一行两个按钮「继续」「结束」**
 *   - 正在计别的作品 → 置灰「其他作品计时中」
 *
 * 「结束」走共享的 `finishGameTimer`（停计时 → 落游玩记录），与通知栏 / 浮层一致。
 */

import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { useTranslation } from "@/hooks/use-translation";

import { finishGameTimer } from "../actions";
import { useGameTimer } from "../hooks";
import { startGameTimer, toggleGameTimerPause } from "../store";

export interface StartGameButtonProps {
  vnId: string;
  vnTitle: string;
}

export function StartGameButton({ vnId, vnTitle }: StartGameButtonProps): JSX.Element {
  const timer = useGameTimer();
  const { t } = useTranslation();
  const accentForeground = useThemeColor("accent-foreground");
  const accentSoftForeground = useThemeColor("accent-soft-foreground");
  const dangerForeground = useThemeColor("danger-foreground");
  const muted = useThemeColor("muted");

  const runningThis = timer.status === "running" && timer.vnId === vnId;
  const pausedThis = timer.status === "paused" && timer.vnId === vnId;
  const busyElsewhere = timer.status !== "idle" && timer.vnId !== vnId;

  // 本作计时中 / 已暂停：同一行给「暂停 / 继续」与「结束」
  if (runningThis || pausedThis) {
    return (
      <View className="flex-row gap-2">
        <Button className="flex-1" variant="secondary" onPress={toggleGameTimerPause}>
          <Icon name={pausedThis ? "play" : "pause"} size={16} color={accentSoftForeground} />
          <Button.Label>{pausedThis ? t("timer.resume") : t("timer.pause")}</Button.Label>
        </Button>
        <Button className="flex-1" variant="danger" onPress={finishGameTimer}>
          <Icon name="stop" size={16} color={dangerForeground} />
          <Button.Label>{t("timer.stop")}</Button.Label>
        </Button>
      </View>
    );
  }

  const disabled = busyElsewhere;
  return (
    <Button className="w-full" isDisabled={disabled} onPress={() => startGameTimer(vnId, vnTitle)}>
      <Icon name="play" size={16} color={disabled ? muted : accentForeground} />
      <Button.Label>{busyElsewhere ? t("timer.busyElsewhere") : t("timer.start")}</Button.Label>
    </Button>
  );
}
