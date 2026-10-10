/**
 * 剧透打码文本。
 *
 * 攻略页签的结局名与步骤内容都走这里：开启「剧透保护」时按**等长**替换成圆点，
 * 点一下就显示原文。打码规则本身在 `../select#maskText`（纯函数，便于冒烟直接测）。
 *
 * ⚠️ 必须等长打码而不是盖遮罩：遮罩揭开的瞬间行高 / 换行位置全变，
 * 一行塌成三行，整个列表往下跳 —— 用户刚点开就被甩出去。
 */

import type { JSX } from "react";
import { useState } from "react";
import { Pressable } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { maskText } from "../select";

export interface SpoilerTextProps {
  text: string;
  /** 是否处于打码状态（通常直接取偏好 `spoilerShield`） */
  shield: boolean;
  /** 正文排版；`plain` 略大一点（结局名用），默认次要文字（步骤内容用） */
  variant?: "muted" | "plain";
  className?: string;
  numberOfLines?: number;
}

export function SpoilerText({
  text,
  shield,
  variant = "muted",
  className = "",
  numberOfLines,
}: SpoilerTextProps): JSX.Element {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  // 开关没开时不需要任何交互，直接显示原文
  if (!shield || revealed) {
    return (
      <Muted
        type="body-sm"
        className={variant === "plain" ? `font-medium ${className}` : className}
        numberOfLines={numberOfLines}
      >
        {text}
      </Muted>
    );
  }

  return (
    <Pressable
      onPress={() => setRevealed(true)}
      className={`flex-1 active:opacity-60 ${className}`}
      accessibilityRole="button"
      accessibilityLabel={t("walkthrough.reveal")}
    >
      {/* `selectable={false}`：外面套着 Pressable，长按归「点开」那一层，
          不关的话系统选区会先弹出来把点击吃掉 */}
      <Muted type="body-sm" numberOfLines={numberOfLines} selectable={false}>
        {maskText(text)}
      </Muted>
    </Pressable>
  );
}
