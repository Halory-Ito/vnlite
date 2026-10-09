/**
 * VN 详情页的「开始游戏」按钮。
 *
 * 全局同时只有一个计时器，按钮据此反映当前状态：
 *   - 空闲 → 「开始游戏」，点击开始计这个作品
 *   - 正在计这个作品 → 置灰「计时中」
 *   - 这个作品已暂停 → 「继续游戏」，点击续上
 *   - 正在计别的作品 → 置灰「其他作品计时中」（先在前台浮层结束）
 */

import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { Icon } from "@/components/icon";

import { useGameTimer } from "../hooks";
import { resumeGameTimer, startGameTimer } from "../store";

export interface StartGameButtonProps {
  vnId: string;
  vnTitle: string;
  /** 作品封面，用于系统通知的大图 */
  coverUrl?: string | null;
}

export function StartGameButton({ vnId, vnTitle, coverUrl }: StartGameButtonProps): JSX.Element {
  const timer = useGameTimer();
  const accentForeground = useThemeColor("accent-foreground");
  const muted = useThemeColor("muted");

  const runningThis = timer.status === "running" && timer.vnId === vnId;
  const pausedThis = timer.status === "paused" && timer.vnId === vnId;
  const busyElsewhere = timer.status !== "idle" && timer.vnId !== vnId;
  const disabled = runningThis || busyElsewhere;

  const label = runningThis
    ? "计时中"
    : pausedThis
      ? "继续游戏"
      : busyElsewhere
        ? "其他作品计时中"
        : "开始游戏";

  return (
    <Button
      className="w-full"
      isDisabled={disabled}
      onPress={() => (pausedThis ? resumeGameTimer() : startGameTimer(vnId, vnTitle, coverUrl))}
    >
      <Icon name="play" size={16} color={disabled ? muted : accentForeground} />
      <Button.Label>{label}</Button.Label>
    </Button>
  );
}
