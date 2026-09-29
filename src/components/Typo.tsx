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
 */

import { Typography } from "heroui-native";
import * as Linking from "expo-linking";
import type { JSX, ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Muted } from "./Muted";

type HeadingProps = React.ComponentProps<typeof Typography.Heading>;
type RootProps = React.ComponentProps<typeof Typography>;

function Heading({
  type,
  className,
  ...rest
}: HeadingProps & { type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }): JSX.Element {
  return <Typography.Heading type={type} className={className} {...rest} />;
}

export const H1 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h1" {...p} />;
export const H2 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h2" {...p} />;
export const H3 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h3" {...p} />;
export const H4 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h4" {...p} />;
export const H5 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h5" {...p} />;
export const H6 = (p: Omit<HeadingProps, "type">): JSX.Element => <Heading type="h6" {...p} />;

/** 正文，`type` 默认 body */
export function Body({ type = "body", className, ...rest }: RootProps): JSX.Element {
  return <Typography type={type} className={className} {...rest} />;
}

export function Paragraph(p: React.ComponentProps<typeof Typography.Paragraph>): JSX.Element {
  return <Typography.Paragraph {...p} />;
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
    <Typography type="body-sm" className={`text-link ${className}`} suppressHighlighting>
      {children}
    </Typography>
  );
}

/**
 * 站外链接。
 *
 * 不用 expo-router 的 `Link`：它的 `href` 类型只认内部路由，
 * 外部 URL 需要强转，直接 `Linking.openURL` 更清楚也更安全。
 */
export function ExternalLinkRow({
  label,
  name,
  url,
}: {
  label: string;
  name: string;
  url: string;
}): JSX.Element {
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      className="flex-row items-center gap-2 py-2 active:opacity-60"
      accessibilityRole="link"
    >
      <Muted type="body-sm" className="flex-1 text-link">
        {label}: {name}
      </Muted>
    </Pressable>
  );
}

/** 外链列表区块 */
export function ExternalLinks({
  links,
  className = "px-4 pb-4",
}: {
  links: readonly { label: string; name: string; url: string }[] | undefined;
  className?: string;
}): JSX.Element | null {
  if (!links || links.length === 0) return null;
  return (
    <View className={className}>
      {links.map((link) => (
        <ExternalLinkRow key={`${link.label}-${link.name}`} {...link} />
      ))}
    </View>
  );
}
