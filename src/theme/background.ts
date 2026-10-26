/**
 * 背景图的纯逻辑：范围常量与默认值。
 *
 * ## 为什么要单独拆一个文件
 *
 * `lib/storage/preferences.ts` 依赖 AsyncStorage，bun / tsc 环境跑不了；
 * 而遮罩范围与默认值恰恰是 `scripts/smoke-theme.ts` 要校验的东西。
 * 这里只留**纯常量**，两边从同一处取，保证「测的和跑的」是同一份。
 *
 * ## 关于文字可读性
 *
 * 背景图是明暗不均的照片，遮罩只能整体压暗、压不住某一块高光区。
 * 曾经试过给文字加「反色描边阴影」来救，真机效果是小字号中文被描边吃掉、
 * 更难认，**已否决**。
 *
 * 所以可读性只有两条路，都不靠改文字本身：
 *   1. 全局：这个遮罩（用户可调 `backgroundOpacity`）
 *   2. 局部：把文字放进 `Card` / `bg-default-soft` 这类有底板的容器
 */

/** 遮罩不透明度范围 */
export const BACKGROUND_OPACITY_RANGE = { min: 0, max: 1, step: 0.01 } as const;

/** 背景图模糊半径范围（pt，交给 `expo-image` 的 `blurRadius`） */
export const BACKGROUND_BLUR_RANGE = { min: 0, max: 40, step: 1 } as const;

/** 背景图位置（0–1，0.5 = 居中） */
export interface BackgroundPosition {
  x: number;
  y: number;
}

/**
 * 背景图位置范围（0–1，0.5 = 居中）。
 *
 * 只是把 `contentFit="cover"` 裁掉的那部分**挪一挪**，不是缩放：
 * 0 = 贴左 / 贴上，1 = 贴右 / 贴下。设备比例与图片比例差得越多，可挪的幅度越大。
 */
export const BACKGROUND_POSITION_RANGE = { min: 0, max: 1, step: 0.01 } as const;

/** 默认位置：居中（与不设置 `contentPosition` 的观感一致） */
export const DEFAULT_BACKGROUND_POSITION = { x: 0.5, y: 0.5 } as const;

/**
 * 位置偏好 → `expo-image` 的 `contentPosition`。
 *
 * 百分比语义与 CSS `object-position` 一致（原生侧就是
 * `(value/100) * (容器尺寸 - 图片尺寸)`），所以 0.5 正好是居中。
 * 输出保留一位小数：滑杆 step 是 0.01，转成 `%` 后不需要更多精度。
 */
export function backgroundContentPosition(
  x: number,
  y: number
): { left: `${number}%`; top: `${number}%` } {
  return { left: toPercent(x), top: toPercent(y) };
}

function toPercent(value: number): `${number}%` {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
  return `${Math.round(clamped * 1000) / 10}%`;
}

/**
 * 默认遮罩不透明度。
 *
 * 0.6 挡不住照片的高光区（浅色/深色文字落在亮部会明显糊掉），
 * 0.82 是「还能看出是图，同时文字稳定可读」的平衡点。
 */
export const DEFAULT_BACKGROUND_OPACITY = 0.82;
