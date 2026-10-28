/**
 * 月历的尺寸常量。
 *
 * 页高必须是常数：`CalendarList` 靠 `calendarHeight` 算每一页的滚动偏移，
 * 4–6 行的月份都不应该改变页高。星期行在翻页器外面固定，不占页高。
 */

/** 一页排 6 行（4–5 行的月份底下留空） */
export const CALENDAR_ROWS = 6;

/** 星期行高度（固定在列表上方） */
export const WEEK_HEADER_HEIGHT = 24;

/** 单个日期单元格高度 */
export const DAY_CELL_HEIGHT = 48;

/** 一页高度：6 行日期（星期行在列表外） */
export const CALENDAR_PAGE_HEIGHT = DAY_CELL_HEIGHT * CALENDAR_ROWS;
