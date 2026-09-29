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

/**
 * 默认遮罩不透明度。
 *
 * 0.6 挡不住照片的高光区（浅色/深色文字落在亮部会明显糊掉），
 * 0.82 是「还能看出是图，同时文字稳定可读」的平衡点。
 */
export const DEFAULT_BACKGROUND_OPACITY = 0.82;
