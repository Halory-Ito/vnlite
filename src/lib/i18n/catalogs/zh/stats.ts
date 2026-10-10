/**
 * 简体中文 · stats 模块（由对应迁移批次填充；结构约定见 zh.core.ts 顶部）。
 *
 * 接入点：`features/stats/**`（记录统计 / 游玩统计 / 数据库统计 / 图表外壳）。
 * 类型标签名与作品名来自 VNDB，**保持原文不翻译**。
 */
export const zhStats = {
  stats: {
    /* 记录统计页 */
    title: "记录统计",
    collectionTitle: "收藏统计",
    loginHint: "统计要读你自己的清单。先在「我的 → 账号」粘贴 VNDB Token",
    goLogin: "去登录",
    collectionLoading: "正在统计你的收藏…",
    collectionEmpty:
      "清单还是空的。去 VNDB 收藏几部作品，这里就会有年代 / 标签 / 类型 / 厂商的分布图",
    total: "收藏总数",
    finished: "已通关",
    averageVote: "我的均分",
    decades: "发售年代",
    labels: "清单标签",
    gameTypes: "游戏类型",
    topDevelopers: "厂商 Top %{count}",
    typesLoading: "正在统计类型标签…",
    typesFailed: "类型统计失败：%{message}",
    typesEmpty: "你的收藏里没有标出 ADV / NVL / RPG 这类类型标签",
    pieEmpty: "没有可统计的数据",

    /* 游玩统计 */
    playTitle: "游玩统计",
    playLoading: "正在读取游玩记录…",
    playFailed: "读取游玩记录失败",
    playEmpty: "还没有游玩记录。在作品详情页点「开始游戏」，结束后就会统计在这里",
    totalTime: "总时长",
    playCount: "游玩次数",
    playedVns: "游玩作品",
    playtimeRanking: "游玩时长排名",
    typePlaytime: "类型时长分布",
    playTypesEmpty: "玩过的作品还没有标出 ADV / NVL / RPG 这类类型标签",
    monthlyPlaytime: "每月游玩时长",
    weeklyPlaytime: "每周游玩统计",
    monthLabel: "%{month}月",

    /* 数据库统计（搜索页空输入） */
    dbVn: "视觉小说",
    dbReleases: "发行版",
    dbCharacters: "角色",
    dbStaff: "制作人员",
    dbProducers: "制作者",
    dbTags: "标签",
    dbTraits: "特性",
    dbFailed: "统计加载失败，稍后再试",
    dbCount: "%{count} 条",
  },
} as const;
