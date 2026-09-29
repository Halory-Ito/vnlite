/**
 * 折叠展示：长文本与长列表（标签 / 特性这类 chip 墙）。
 *
 * 动机：VNDB 的简介常有几千字、标签动辄几十个，一进来就铺满整屏 ——
 * 用户看不到真正想看的属性，而且**页面被撑得过长时，下方内容在部分设备上
 * 会渲染不出来**（Android 对单屏内容高度有上限）。
 * 所以所有「长内容」都默认折叠，点一下再展开。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Paragraph } from "./Typo";

/* -------------------------------------------------------------------------- */
/* 长文本                                                                      */
/* -------------------------------------------------------------------------- */

export interface CollapsibleTextProps {
  text: string;
  /** 收起时显示几行 */
  lines?: number;
  className?: string;
}

export function CollapsibleText({
  text,
  lines = 6,
  className = "",
}: CollapsibleTextProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  return (
    <View className="gap-1.5">
      <Paragraph
        className={`text-sm leading-5 ${className}`}
        numberOfLines={expanded ? undefined : lines}
        onTextLayout={(event) => {
          // 展开状态下行数一定变多，这时不判断，免得把 truncated 顶掉
          if (expanded) return;
          /*
           * ⚠️ 判定用「行数 >= 限制」而不是「>」：文本被 `numberOfLines` 截断时，
           * 回调报的就是上限值（6 行），拿不到真实总行数。副作用是「刚好 6 行」的
           * 简介也会出现展开按钮 —— 点开内容不变，无害，比漏掉按钮强。
           */
          const next = event.nativeEvent.lines.length >= lines;
          setTruncated((prev) => (prev === next ? prev : next));
        }}
      >
        {text}
      </Paragraph>

      {truncated || expanded ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          className="self-start active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={expanded ? "收起" : "展开全部"}
        >
          <Typography type="body-sm" className="text-link">
            {expanded ? "收起" : "展开全部"}
          </Typography>
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 长列表                                                                      */
/* -------------------------------------------------------------------------- */

export interface CollapsedList<T> {
  expanded: boolean;
  /** 当前该渲染的那一段 */
  shown: readonly T[];
  /** 是否真的有被折叠掉的内容（没有就别挂展开按钮） */
  truncated: boolean;
  toggle: () => void;
}

/** 长列表折叠的公共逻辑。渲染交给调用方（要包 Link、要分组都随它） */
export function useCollapsedList<T>(items: readonly T[], limit: number): CollapsedList<T> {
  const [expanded, setExpanded] = useState(false);

  return {
    expanded,
    shown: expanded ? items : items.slice(0, limit),
    truncated: items.length > limit,
    toggle: () => setExpanded((v) => !v),
  };
}

/** 「展开全部 N 个 / 收起」。和 `CollapsibleText` 的按钮同一套排版 */
export function ExpandToggle({
  expanded,
  total,
  onPress,
}: {
  expanded: boolean;
  total: number;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className="self-start active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={expanded ? "收起" : `展开全部 ${total} 个`}
    >
      <Typography type="body-sm" className="text-link">
        {expanded ? "收起" : `展开全部 ${total} 个`}
      </Typography>
    </Pressable>
  );
}
