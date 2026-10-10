/**
 * 简体中文 · vn 模块（VN 详情页与各页签、作品列表行 / 封面墙）。
 */
export const zhVn = {
  vn: {
    /** 详情页外壳 */
    loading: "加载作品信息…",
    notFoundTitle: "作品不存在",
    notFoundDescription: "它可能已从 VNDB 删除",
    statVotes: "评价人数",
    statRating: "均分",
    statLength: "游玩时长",

    /** 详情页页签（与 vndb.org 的区块名对齐） */
    tabInfo: "概览",
    tabCharacters: "角色",
    tabStaff: "制作",
    tabReleases: "版本",
    tabScreenshots: "截图",
    tabRelations: "关联",
    tabQuotes: "语录",
    tabDiscussions: "讨论",
    tabWalkthrough: "攻略",
    tabRecords: "记录",
    tabExtLinks: "外链",

    /** 概览页签 */
    description: "简介",
    noDescription: "该作品没有登记简介",
    tags: "标签",

    /** 角色页签 */
    charactersLoading: "加载角色…",
    charactersEmpty: "该作品没有登记角色",

    /** 制作页签 */
    staffEmpty: "没有登记制作人员",
    cast: "配音",

    /** 版本页签 */
    releasesLoading: "加载发行版…",
    releasesEmpty: "没有登记发行版",

    /** 截图页签 */
    screenshotsEmptyTitle: "没有截图",
    screenshotsEmptyDescription: "该作品没有上传截图",
    screenshotHint: "作品截图，点击全屏查看",
    screenshotLabel: "截图 %{index}",

    /** 关联页签 */
    relationsEmptyTitle: "没有关联作品",
    relationsEmptyDescription: "VNDB 上没有登记关联条目",
    official: "官方",
    unofficial: "非官方",

    /** 语录页签 */
    quotesLoading: "加载语录…",
    quotesEmpty: "该作品没有登记语录",

    /** 列表（浏览 / 搜索 / 标签等处的作品列表） */
    listEmpty: "没有找到作品",
    /** 列表尾部的总数（没有更多时显示） */
    totalCount: "共 %{count} 部",
  },
} as const;
