/**
 * 简体中文 · ranking 模块（年度榜 / 题材榜 / 大赏）。
 *
 * 接入点：`features/ranking/*`（首页「排行榜」入口 → `/ranking`）。
 */
export const zhRanking = {
  ranking: {
    title: "排行榜",
    modeYear: "年度",
    modeTag: "题材",
    modeAwards: "大赏",

    pickYear: "选择年份",
    pickTag: "选择题材",
    pickTagCount: "选择题材 (%{count})",
    pickDept: "选择部门",

    /** 选择题材面板 */
    tagSearchResults: "搜索结果",
    selectedTitle: "已选",
    poolTitle: "题材列表",
    tagPoolEmpty: "还没有题材，用上面的搜索加一个",

    loading: "正在算榜…",
    emptyTitle: "这个榜还没有作品",
    emptyDescription: "换一个年份或题材试试",
    scoreMeta: "%{rating} 分 · %{votes} 票",
    rowLabel: "第 %{rank} 名：%{title}",

    /** 两类大赏切换（awards-section） */
    awardsMoe: "萌系游戏大赏",
    awardsGetchu: "美少女游戏大赏",

    /** 萌系主线层级 */
    prizeGrand: "大賞",
    prizeSemi: "準大賞",
    prizeGold: "金賞",
    prizeSilver: "銀賞",
    prizeBronze: "銅賞",

    /** Getchu 的部门 */
    deptTotal: "総合",
    deptScenario: "剧本",
    deptSystem: "系统",
    deptGraphic: "画面",
    deptMusic: "音乐",
    deptMovie: "影片",
    deptChara: "角色",
    deptEros: "工口",
    deptNaming: "作品命名",
    deptVoice: "配音",
    deptTheme: "主题曲",
    deptVocal: "Vocal",
    deptBgm: "BGM",
  },
} as const;
