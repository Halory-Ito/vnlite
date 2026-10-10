/**
 * 简体中文 · favorite 模块（由对应迁移批次填充；结构约定见 zh.core.ts 顶部）。
 *
 * 接入点：`features/favorite/**`（收藏页 / 收藏按钮 / 收藏列表）。
 */
export const zhFavorite = {
  favorite: {
    /* 页面 */
    title: "我的收藏",
    tabVn: "作品",
    tabPeople: "人员",
    tabUser: "用户",
    tabProducer: "厂商",
    loading: "加载收藏…",
    emptyTitle: "暂无收藏",
    emptyDescription: "在作品、人员、用户与厂商详情页点星标即可收藏",
    loadingMore: "加载更多…",
    longPressRemove: "长按取消收藏",
    clear: "清空收藏",
    clearDescription: "会删除勾选分类的全部收藏，且不可撤销。",

    /* 收藏按钮 */
    favorite: "收藏",
    favorited: "已收藏",
    addLabel: "收藏",
    removeLabel: "取消收藏",
    addedToast: "已收藏",
    removedToast: "已取消收藏",
  },
} as const;
