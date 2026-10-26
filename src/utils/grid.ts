/**
 * 作品封面网格的列数（纯逻辑，`smoke:layout` 直接测）。
 *
 * 手机 3 列；平板分两档：短边 ≥ 800dp 用 8 列（iPad 10.9" 及更大的板子），
 * 600–799dp 用 6 列（iPad mini 竖屏 744dp）。
 *
 * ## 为什么看短边，而不是宽度 / dpi
 *
 * 1. **dpi 判不出来**。iOS 上 `PixelRatio` 对所有 iPad 都是 2，像素密度
 *    跟「大板还是 mini」根本不是一回事；拿它分档必然判错。
 * 2. **只看宽度会误伤横屏手机**。iPhone 横屏已有 844dp，按宽度会被当成平板。
 *    短边（`min(width, height)`）在手机上始终 < 600，横竖屏都不会误判；
 *    平板横竖屏的短边不变，转屏时列数也不会跳。
 */

/** 手机（含横屏） */
export const COVER_GRID_COLUMNS_PHONE = 3;
/** 小平板（iPad mini / 600–799dp） */
export const COVER_GRID_COLUMNS_COMPACT_TABLET = 6;
/** 大平板（≥ 800dp） */
export const COVER_GRID_COLUMNS_TABLET = 8;

/** 平板短边下限（dp）。600 是 Material / iPad 分界的常用值 */
export const COVER_GRID_TABLET_MIN_SHORT_SIDE = 600;
/** 大平板短边下限（dp）。iPad mini 744dp 落在它下面 */
export const COVER_GRID_LARGE_MIN_SHORT_SIDE = 800;

/**
 * 窗口尺寸 → 网格列数。
 *
 * @param width 窗口宽度（dp）
 * @param height 窗口高度（dp）
 */
export function coverGridColumns(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  if (shortSide < COVER_GRID_TABLET_MIN_SHORT_SIDE) return COVER_GRID_COLUMNS_PHONE;
  return shortSide >= COVER_GRID_LARGE_MIN_SHORT_SIDE
    ? COVER_GRID_COLUMNS_TABLET
    : COVER_GRID_COLUMNS_COMPACT_TABLET;
}

/* -------------------------------------------------------------------------- */
/* 作品截图墙                                                                  */
/* -------------------------------------------------------------------------- */

/** 手机：单列（沿用原来的大图列表） */
export const SCREENSHOT_COLUMNS_PHONE = 1;
/** 小平板（iPad mini / 600–799dp）：3 列 */
export const SCREENSHOT_COLUMNS_COMPACT_TABLET = 3;
/** 大平板（≥ 800dp）：4 列 */
export const SCREENSHOT_COLUMNS_TABLET = 4;

/**
 * 截图墙列数。
 *
 * 分档与封面网格一致（`coverGridColumns` 的同一条理由：看短边，不看 dpi / 宽度），
 * 只是每一档都少几列 —— 截图单张信息量大，4 列已经是「还能看清」的上限。
 */
export function screenshotColumns(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  if (shortSide < COVER_GRID_TABLET_MIN_SHORT_SIDE) return SCREENSHOT_COLUMNS_PHONE;
  return shortSide >= COVER_GRID_LARGE_MIN_SHORT_SIDE
    ? SCREENSHOT_COLUMNS_TABLET
    : SCREENSHOT_COLUMNS_COMPACT_TABLET;
}
