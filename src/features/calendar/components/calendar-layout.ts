/**
 * 月历的尺寸常量。
 *
 * 日期格固定高度，避免切月时页面发生跳动。
 */

/** 一页排 6 行（4–5 行的月份底下留空） */
export const CALENDAR_ROWS = 6;

/** 星期行高度（固定在列表上方） */
export const WEEK_HEADER_HEIGHT = 24;

/** 单个日期单元格高度 */
export const DAY_CELL_HEIGHT = 48;

/** 一页高度：6 行日期（星期行在列表外） */
export const CALENDAR_PAGE_HEIGHT = DAY_CELL_HEIGHT * CALENDAR_ROWS;
