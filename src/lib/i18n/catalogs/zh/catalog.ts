/**
 * 简体中文 · catalog 模块（角色 / 制作者 / staff / 标签详情 + 外链卡片）。
 */
export const zhCatalog = {
  catalog: {
    /** 详情页外壳 / 兜底标题 */
    characterFallback: "角色",
    producerFallback: "制作者",
    staffFallback: "制作人员",
    tagFallback: "标签",

    /** 角色详情 */
    sex: "性别",
    age: "年龄",
    birthday: "生日",
    birthdayFormat: "%{month} 月 %{day} 日",
    birthdayMonth: "%{month} 月",
    bloodType: "血型",
    body: "体型",
    bust: "胸围 %{cm} cm",
    traits: "特性",
    description: "简介",

    /** 制作者 / staff 详情（页签外壳） */
    tabOverview: "概览",
    tabWorks: "作品",
    tabExtLinks: "外链",
    worksLoading: "拉取作品…",
    worksEmptyTitle: "没有收录作品",
    worksEmptyProducer: "VNDB 上这个制作者名下还没有作品",
    worksEmptyStaff: "VNDB 上这个制作人员名下还没有作品",
    extlinksEmptyProducer: "VNDB 上这个制作者没有登记外链",
    extlinksEmptyStaff: "VNDB 上这个制作人员没有登记外链",
    producerNoDescription: "该制作者没有登记简介",
    staffNoDescription: "该制作人员没有登记简介",
    relatedVns: "登场作品",

    /** 标签详情 */
    tagDescription: "说明",
    tagCount: "%{count} 部作品含此标签",
    tagWorksTitle: "作品列表",
    tagDirectOnly: "仅直接标签",
    tagInherited: "含父标签",
    tagWorksEmpty: "该标签下暂无作品",

    /** 外链卡片（VN / 制作者 / staff 共用） */
    extlinksEmptyTitle: "没有外部链接",
    extlinksEmptyDescription: "VNDB 上没有登记外链",
    extlinksCopied: "已复制链接",
    extlinksOpen: "打开 %{site}：%{name}",
    /** 厂商 LOGO 的无障碍标签 */
    logoLabel: "%{name} LOGO",
    /** 站点名（VNDB 的 label 是英文短标识；专有名词保留原文） */
    siteHomepage: "官方网站",
    siteWikipediaJa: "Wikipedia（日文）",
    siteDengeki: "电击",
  },
} as const;
