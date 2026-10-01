/**
 * 图标组件。
 *
 * 图标集是 Gravity UI Icons，源码内置在 `icon-glyphs.ts`（原因见那个文件的注释）。
 * 这里只负责把它交给 `react-native-svg` 的 `SvgXml` 渲染。
 *
 * ⚠️ `color` 是**必填**的：SVG 里用的是 `fill="currentColor"`，
 * 而 RNSVG 在拿不到 `color` 时会回退成黑色 —— 深色主题下就是「图标看不见」。
 * 颜色一律显式取主题 token（`useThemeColor(...)`），别写死。
 */

import type { JSX } from "react";
import type { ColorValue } from "react-native";
import { SvgXml } from "react-native-svg";

import { ICON_GLYPHS, type IconName } from "./icon-glyphs";

export interface IconProps {
  name: IconName;
  /** 边长（pt），默认 16（Gravity UI 图标的原生尺寸） */
  size?: number;
  /** 颜色，取主题 token；不传会变黑，所以必填 */
  color: ColorValue;
}

export function Icon({ name, size = 16, color }: IconProps): JSX.Element {
  return <SvgXml xml={ICON_GLYPHS[name]} width={size} height={size} color={color} />;
}

export type { IconName };
