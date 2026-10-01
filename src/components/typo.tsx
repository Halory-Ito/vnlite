/**
 * 排版薄封装。
 *
 * HeroUI Native 的 `Typography` 只有一个子组件家族：
 *   `Typography`（根，用 `type` 决定字号）/ `.Heading` / `.Paragraph` / `.Code`
 * 没有 `Typography.H1..H6`，也没有 `Typography.Text`，所以这里包一层，
 * 调用点更短，也避免每个页面重复写 `type="body-sm"`。
 *
 * 配色只用 HeroUI 实际提供的 token —— 注意**没有** `muted-foreground`，
 * 次要文字统一用 `text-muted`。
 *
 * ⚠️ **不要给文字加描边/阴影来解决「背景图上看不清」**。
 * 试过一版「文字反色描边阴影」，真机效果是字被描边吃掉、更难认
 * （尤其小字号 + 中文），Master 已否决。
 * 可读性只能靠**遮罩**和**不透明容器**解决：
 *   - 全局：`AppBackground` 的遮罩层（用户可调 `backgroundOpacity`）
 *   - 局部：把文字放进 `Card` / `bg-default-soft` 这类有底板的容器里
 *
 * ## 选中复制（全局）
 *
 * 所有排版组件默认 `selectable`：长按文字 → 拖选 → 系统菜单「复制」，
 * 用户能只复制其中一段（作品名里的一段、简介里的一句话）。
 * 全局默认开着，各页面就不用逐个想起来加；要关掉的地方显式传 `selectable={false}`。
 *
 * ⚠️ 系统选区只在「文字自己就是触摸响应者」时才出现 —— 文字外面若套了
 * `Pressable`（列表行、站内链接），JS 的 responder 会先拿到触摸，
 * 那一层长按走的是「整条复制」（见 `hooks/use-copy`）。
 * 所以**可点的那一层里的文字要显式传 `selectable={false}`**：
 * 不关的话平台差异会让「长按整条复制」时灵时不灵（Android 上系统选区可能先弹出来）。
 * `LinkText` 同理（链接外面套着 `Link`）。
 */

import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";

import { Muted } from "./muted";

/** 全局选中复制。放在展开的 props **前面**，调用点显式传的 `selectable` 才赢 */
const SELECTABLE = { selectable: true } as const;

type HeadingProps = React.ComponentProps<typeof Typography.Heading>;
type RootProps = React.ComponentProps<typeof Typography>;

function Heading({
  type,
  className,
  ...rest
}: HeadingProps & { type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }): JSX.Element {
  return <Typography.Heading type={type} className={className} {...SELECTABLE} {...rest} />;
}

export const H1 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h1" {...p} />;
export const H2 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h2" {...p} />;
export const H3 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h3" {...p} />;
export const H4 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h4" {...p} />;
export const H5 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h5" {...p} />;
export const H6 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h6" {...p} />;

/** 正文，`type` 默认 body */
export function Body({ type = "body", className, ...rest }: RootProps): JSX.Element {
  return <Typography type={type} className={className} {...SELECTABLE} {...rest} />;
}

export function Paragraph(p: React.ComponentProps<typeof Typography.Paragraph>): JSX.Element {
  return <Typography.Paragraph {...SELECTABLE} {...p} />;
}

export { Muted };

/* -------------------------------------------------------------------------- */
/* 链接                                                                        */
/* -------------------------------------------------------------------------- */

/** 站内路由链接的视觉样式（配合 expo-router 的 `Link asChild`） */
export function LinkText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    // `selectable={false}`：链接外面套着 `Link`（Pressable），长按归「点开链接」那一层，
    // 弹选区只会挡住它
    <Typography
      type="body-sm"
      className={`text-link ${className}`}
      suppressHighlighting
      selectable={false}
    >
      {children}
    </Typography>
  );
}

// ⚠️ 这里原来还有 `ExternalLinkRow` / `ExternalLinks`（纯文本行「label: name」）。
// 外链现在一律走 `components/ext-link-cards` 的卡片式（详情页与站内页共用一份），
// 那两个组件已无引用，删除。
