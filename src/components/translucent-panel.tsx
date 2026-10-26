/**
 * 半透明的内容面板。
 *
 * 设置页里没有用 `ListGroup` 的地方（分段控件、滑杆组、登录表单）用它包一层，
 * 视觉上和半透明的 ListGroup / Card 对齐。
 *
 * 圆角直接写进 `style`（数值 = HeroUI `--radius-3xl`）：底色本来就是
 * `style` 注入的，圆角跟着一起给，不依赖 utility class 是否被 uniwind 编出来。
 */

import type { JSX, ReactNode } from "react";
import { View } from "react-native";

import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { SURFACE_RADIUS } from "@/theme/surface";

export interface TranslucentPanelProps {
  children: ReactNode;
  /** 追加的布局类（默认已经带了内边距，圆角与底色由 style 保证） */
  className?: string;
}

export function TranslucentPanel({ children, className = "" }: TranslucentPanelProps): JSX.Element {
  const surface = useTranslucentSurface();
  return (
    <View className={`p-4 ${className}`} style={[surface, { borderRadius: SURFACE_RADIUS }]}>
      {children}
    </View>
  );
}
