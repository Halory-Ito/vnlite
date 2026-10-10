/**
 * 简体中文文案 · search 模块（搜索页的四档范围与结果状态）。
 *
 * 接入点：
 *   - `features/search/search-logic.ts`（档位名 / 集合名 / 结果标题等纯函数文案；
 *     模块级表里存 `TranslationKey`，渲染时 `t(key)`）
 *   - `features/search/components/*`（搜索框 / 结果列表 / 空态）
 *
 * 约定见 `zh.core.ts` 顶部。搜「作品 / 人员 / 用户 / 厂商」的完整说法见
 * `noun`，分段控件上用短名 `scope`。
 */
export const zhSearch = {
  search: {
    /** 分段控件上的短名 */
    scope: {
      vn: "作品",
      staff: "人员",
      user: "用户",
      producer: "厂商",
    },

    /** 完整集合名：空态文案（「没有与 x 匹配的制作者」）与行长数据用 */
    noun: {
      vn: "作品",
      staff: "制作人员",
      user: "用户",
      producer: "制作者",
    },

    loading: "搜索中…",
    loadingMore: "加载更多…",
    lookingUp: "查找中…",

    emptyTitle: "没有找到",
    emptyDescription: "没有与「%{keyword}」匹配的%{noun}",
    userEmptyTitle: "没有找到用户",
    vnEmptyTitle: "没有找到作品",

    /** 结果列表顶部的标题（不带到档位名） */
    resultsHeadline: "搜索「%{keyword}」的结果",

    /** 用户档查不到时的说明：id 形式与用户名形式不同 */
    userMissId: "没有这个用户 ID（%{id}）",
    userMissHint: "要搜完整用户名（如 Yorhel）或用户 ID（如 u2）—— 用户接口不支持模糊搜索",
  },
} as const;
