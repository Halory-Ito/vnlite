/**
 * 简体中文 · walkthrough 模块（攻略页签）。
 *
 * 接入点：`features/walkthrough/select`（结局 / 步骤类型映射）与
 * `features/walkthrough/components/*`。
 * 线路名 / 结局名 / 章节名 / 步骤内容来自攻略仓库，是**数据**，不在这里翻译。
 */
export const zhWalkthrough = {
  walkthrough: {
    loadingIndex: "加载攻略索引…",
    loading: "加载攻略…",
    emptyTitle: "暂无攻略",
    emptyDescription: "攻略由社区维护，覆盖范围有限，这部作品还不在其中",
    noContent: "这份攻略暂时没有可用内容",

    /** 结局类型徽标（select#endingMeta） */
    ending: {
      true: "真结局",
      good: "好结局",
      normal: "普通结局",
      bad: "bad 结局",
    },

    /** 步骤类型小标签（select#stepMeta） */
    step: {
      save: "存档",
      load: "读档",
      note: "备注",
    },

    /** 攻略详细程度（select#levelLabel） */
    level: {
      detailed: "详细攻略",
      brief: "简略攻略",
    },

    /** 页头重点计数（walkthrough-meta） */
    starred: "重点 %{count}",

    /** 步骤 / 结局的读屏与剧透文案 */
    markStep: "标记已走过：%{step}",
    unmarkStep: "取消已走过：%{step}",
    markEnding: "标记已达成：%{ending}",
    unmarkEnding: "取消已达成：%{ending}",
    expandRoute: "%{route}，点按展开该线路的结局",
    expandEnding: "%{ending}，点按展开步骤",
    reveal: "点按显示",
    showMore: "显示更多（还有 %{count} 步）",
    showMoreLabel: "显示更多步骤，还有 %{count} 步",
  },
} as const;
