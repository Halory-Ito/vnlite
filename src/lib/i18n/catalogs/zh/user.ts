/**
 * 简体中文 · user 模块（由对应迁移批次填充；结构约定见 zh.core.ts 顶部）。
 *
 * 接入点：`features/user/**`（用户资料 / 全部投票 / 投票列 / 直方图）。
 * 用户名、作品名、自我标记的特性名来自 VNDB，**保持原文不翻译**。
 */
export const zhUser = {
  user: {
    /* 资料页 */
    title: "用户",
    loadingProfile: "抓取资料…",
    notFoundTitle: "拿不到这个用户的资料",
    notFoundDescription: "用户不存在，或 VNDB 改版导致解析失败",
    statListVns: "清单作品",
    statVotes: "投票数",
    statPosts: "发帖数",
    profileSection: "资料",
    username: "用户名",
    registered: "注册",
    playtime: "时长",
    playthroughs: "（%{count} 次统计）",
    edits: "编辑",
    listStats: "清单",
    listReleases: "%{count} 个发行版",
    reviewsLabel: "评价",
    reviewCount: "%{count} 篇",
    threadsLabel: "主题",
    threadCount: "%{count} 个",
    traitsSection: "自我标记的特性",
    voteDistribution: "打分分布",
    recentVotes: "近期打分",
    viewAll: "查看全部",
    viewAllLabel: "查看全部打分记录",

    /* 全部打分列表 */
    votesTitle: "%{name} 的打分",
    allVotes: "全部打分",
    fetching: "拉取中…",
    loadedCount: "已加载 %{count} 条",
    loadingVotes: "拉取打分记录…",
    votesEmpty: "这个用户没有公开的打分记录",
    noMore: "没有更多了",

    /* 显示列 */
    columns: "列",
    columnsLabel: "控制显示哪些列",
    columnsPanelTitle: "显示哪些列",
    columnsGroup: "列表里显示的信息",
    columnTitle: "作品名称",
    columnScore: "评分",
    columnPlaytime: "游玩时长",
    columnSpeed: "通关速度",
    columnVotedAt: "投票时间",
    columnStarted: "开始",
    columnFinished: "完成",
    fieldScore: "评分",
    fieldPlaytime: "时长",
    fieldSpeed: "速度",
    fieldVotedAt: "投票",
    fieldStarted: "开始",
    fieldFinished: "完成",
    openVn: "打开作品：%{title}",
  },
} as const;
