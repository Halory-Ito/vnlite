/**
 * 简体中文 · history 模块（由对应迁移批次填充；结构约定见 zh.core.ts 顶部）。
 *
 * 接入点：`features/history/**`（浏览历史页 / 日期筛选面板 / OTP 日期输入 / 清空弹窗）。
 */
export const zhHistory = {
  history: {
    /* 页面 */
    title: "浏览历史",
    tabVn: "作品",
    tabPeople: "人员",
    tabUser: "用户",
    tabProducer: "厂商",
    loading: "加载历史记录…",
    emptyTitle: "暂无浏览历史",
    emptyDescription: "浏览过的作品、人员、用户与厂商会记录在这里",
    loadingMore: "加载更多…",
    longPressRemove: "长按删除",
    timeRange: "时间范围",
    timeRangeFiltered: "时间范围，已筛选",
    clearTitle: "清空浏览历史",
    clearDescription: "会删除勾选分类的全部记录，且不可撤销。",

    /* 日期筛选面板 */
    quickSelect: "快捷选择",
    presetToday: "今天",
    presetWeek: "近 7 天",
    presetMonth: "近 30 天",
    startDate: "开始日期",
    endDate: "结束日期",
    today: "今天",
    setToday: "%{label}设为今天",
    clearField: "清除%{label}",
    dateIncomplete: "请填满 8 位",
    dateInvalid: "日期无效",
    dateRangeOrder: "结束日期早于开始日期",
  },
} as const;
