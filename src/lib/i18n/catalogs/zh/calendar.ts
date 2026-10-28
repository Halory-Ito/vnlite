/**
 * 简体中文 · calendar 模块（发售日历）。
 *
 * 接入点：`features/calendar/*`（首页「发售日历」入口 → `/calendar`）。
 */
export const zhCalendar = {
  calendar: {
    title: "发售日历",
    monthTitle: "%{year} 年 %{month} 月",
    /** 读屏用（日历本身靠上下滑动切月，没有左右箭头） */
    prevMonth: "上个月",
    nextMonth: "下个月",
    jump: "跳转",
    jumpTitle: "跳到指定日期",
    jumpDateLabel: "日期",
    jumpConfirm: "跳转",
    loading: "正在摆日历…",
    unrated: "暂无评分",
    /** 周日到周六的短名，逗号分隔（i18n 不方便放数组） */
    weekdays: "日,一,二,三,四,五,六",
    dayLabel: "%{day} 日，查看当天发售",
    dayEmpty: "这天没有作品发售",
  },
} as const;
