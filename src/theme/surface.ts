/**
 * 卡片 / item 底色的**纯逻辑**部分：透明度范围与默认值。
 *
 * 全局背景图铺在最底层，卡片如果是不透明的 `surface`，整屏就只剩一条条色块。
 * 这里只管「多透」这一个数值，实际取色在 `hooks/use-translucent-surface`。
 *
 * 为什么单独拆文件：与 `theme/background` 一样，冒烟脚本要能在 bun 里 import，
 * 而 `lib/storage/preferences` 依赖 AsyncStorage。
 */

/** 卡片透明度范围（0 = 完全透明，1 = 不透明） */
export const CARD_OPACITY_RANGE = { min: 0, max: 1, step: 0.01 } as const;

/**
 * 默认卡片透明度。
 *
 * 0.72 是「还能看出这是张卡片，同时背景图透得出来」的平衡点：
 * 再高背景图基本看不见，再低文字就开始和背景图的高光区打架。
 */
export const DEFAULT_CARD_OPACITY = 0.72;

/**
 * 卡片圆角（px）。
 *
 * 与 HeroUI `Surface` 的 `--radius-3xl`（1.5rem）对齐 —— 这样「外面包一层」
 * 的 `TranslucentPanel` 和真正的 Card / ListGroup 边角一致。
 *
 * 用数值而不是 `rounded-3xl` 类：类名走 uniwind 的编译结果，
 * 而这里的底色本来就靠 `style` 注入，圆角跟着一起给最稳。
 */
export const SURFACE_RADIUS = 24;
