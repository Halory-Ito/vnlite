/**
 * 简体中文 · records 模块（游玩记录页签 / 图表 / 列表 / 设置弹窗）。
 *
 * 接入点：`features/play-records/components/*`、`format`、`session-time`。
 */
export const zhRecords = {
  records: {
    loading: "加载游玩记录…",
    emptyTitle: "暂无游玩记录",
    emptyDescription: "在作品详情页点「开始游戏」，结束后会记录在这里",

    /** 图表 / 列表视图切换（play-records-tab） */
    view: {
      chart: "图表",
      list: "列表",
    },

    /** 图表视图（play-records-chart） */
    chart: {
      total: "总时长",
      sessions: "游玩次数",
      average: "平均每次",
      longest: "最长一次",
      previousMonth: "上个月",
      nextMonth: "下个月",
      monthSummary: "本月 %{duration} · 共 %{count} 次",
      monthEmpty: "这个月还没有游玩记录",
    },

    /** 列表视图与删除确认（play-records-list） */
    list: {
      edit: "设置",
      delete: "删除",
      deleteTitle: "删除记录",
      deleteDescription: "删除后不可恢复。",
    },

    /** 设置弹窗（session-edit-dialog） */
    edit: {
      title: "设置记录",
      start: "开始",
      end: "结束",
      invalid: "时间无效",
      datePlaceholder: "YYYY-MM-DD",
      timePlaceholder: "HH:mm",
      dateField: "%{label}日期",
      timeField: "%{label}时间",
    },

    /** 输入校验（session-time） */
    error: {
      dateFormat: "日期格式应为 YYYY-MM-DD",
      timeFormat: "时间格式应为 HH:mm",
      range: "结束时间早于开始时间",
    },

    /** 详细时长（format#formatPlayDuration）；紧凑格式 `12.5 h` 与语言无关 */
    duration: {
      seconds: "%{seconds} 秒",
      minutes: "%{minutes} 分钟",
      hours: "%{hours} 小时",
      hoursMinutes: "%{hours} 小时 %{minutes} 分",
    },

    /** 图表标题的年月（format#formatYearMonth，`month` 为 1–12） */
    yearMonth: "%{year} 年 %{month} 月",
  },
} as const;
