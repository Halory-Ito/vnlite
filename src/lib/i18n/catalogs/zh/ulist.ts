/**
 * 简体中文 · ulist 模块（由对应迁移批次填充；结构约定见 zh.core.ts 顶部）。
 *
 * 接入点：`app/(tabs)/list` + `app/ulist/[id]` + `features/ulist/**`。
 * 清单的自建标签名 / 内置标签 / 发行版持有状态来自 VNDB，**保持英文原文**。
 */
export const zhUlist = {
  ulist: {
    /* 清单 Tab */
    loadingAccount: "加载账号…",
    guestTitle: "登录后启用清单",
    goLogin: "去登录",
    loadingList: "从 VNDB 拉取清单…",
    emptyTitle: "清单是空的",
    emptyDescription: "下拉刷新可从 VNDB 重新获取；也可以先去 vndb.org 网站上收藏作品",
    emptyLabelTitle: "该标签下没有作品",
    emptyLabelDescription: "下拉刷新可从 VNDB 重新获取",
    loadMore: "加载更多",
    loadingMore: "加载更多…",

    /* 条目编辑页 */
    invalidIdTitle: "无效的作品 ID",
    invalidIdDescription: "清单条目的链接不合法，请回到清单列表重新进入",
    loadingEntry: "从 VNDB 拉取清单条目…",
    coverLabel: "%{title} 封面",
    openVnDetails: "查看 %{title} 的详情",
    editEntryLabel: "编辑清单条目（状态 / 打分 / 标签）",
    startedDate: "开始日期",
    finishedDate: "完成日期",
    notesLabel: "备注（仅自己可见）",
    notesPlaceholder: "写点感想…",
    notes: "备注",
    saveChanges: "保存更改",
    processing: "处理中…",
    savedToVndb: "已保存到 VNDB",
    saveFailed: "保存失败，请重试",
    dateFormatError: "格式应为 YYYY-MM-DD",
    dateRangeError: "完成日期早于开始日期",

    /* 加入 / 移出清单 */
    notInListTitle: "还没有加入清单",
    notInListDescription: "加入后可以打分、贴标签、记录游玩进度；数据直接写回 VNDB",
    adding: "加入中…",
    addToList: "加入清单",
    added: "已加入清单",
    addFailed: "加入失败，请重试",
    remove: "移除",
    removeFromList: "移出清单",
    removeConfirm: "移出",
    confirmRemove: "确认移出",
    removeConfirmDescription: "会同时删除该作品的全部发行版持有记录，且不可撤销。",
    removeHint: "移出会同时删除该作品的全部发行版持有记录，且不可撤销",
    removed: "已移出清单",
    removeFailed: "移出失败，请重试",

    /* 标签编辑 */
    statusLabel: "状态（点已选中的可取消）",
    customLabels: "自建标签",
    moreLabels: "+%{count} labels",

    /* 打分 */
    vote: "打分",
    voteRange: "打分（10–100）",
    notVoted: "未打分",
    clearVote: "清除打分",

    /* 日期输入 */
    today: "今天",
    setToday: "%{label}设为今天",
    clearField: "清除%{label}",

    /* 发行版持有状态 */
    checking: "查询中…",
    updateFailed: "更新失败，请重试",
  },
} as const;
