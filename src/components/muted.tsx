/**
 * 次要文字。
 *
 * HeroUI Native 的主题 token 里**没有** `muted-foreground`，
 * 只有 `muted`，所以所有次要文字统一走这里，避免每个页面各写一遍。
 *
 * ⚠️ 不要在这里加描边/阴影。试过一版「文字反色描边」，真机上小字号中文
 * 被描边吃掉、更难认，Master 已否决。可读性靠遮罩和不透明底板解决，
 * 详见 `components/typo.tsx` 顶部的说明。
 *
 * `selectable` 默认开着：长按可选中这一行文字复制（全局行为，
 * 与 `typo.tsx` 的其余排版组件一致），要关掉的地方显式传 `selectable={false}`。
 */

import { Typography } from "heroui-native";
import type { JSX } from "react";

type RootProps = React.ComponentProps<typeof Typography>;

export function Muted({ className = "", type = "body-sm", ...rest }: RootProps): JSX.Element {
  return <Typography type={type} className={`text-muted ${className}`} selectable {...rest} />;
}
