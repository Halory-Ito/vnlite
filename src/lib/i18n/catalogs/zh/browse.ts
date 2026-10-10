/**
 * 简体中文文案 · browse 模块（浏览页的筛选 / 排序 / 卡片显示面板）。
 *
 * 接入点：
 *   - `app/(tabs)/explore.tsx`（顶部工具栏与空态）
 *   - `features/browse/components/*`（筛选面板 / 汇总条 / 排序面板 / 显示面板 / 分组）
 *   - `features/sort/sort-options.ts`（排序字段名，存 `TranslationKey`）
 *
 * 约定见 `zh.core.ts` 顶部；枚举文案（语言 / 平台 / 开发状态）走
 * `utils/format` 的 `languageLabel()` / `platformLabel()` / `devStatusLabel()`。
 */
export const zhBrowse = {
  browse: {
    /** explore.tsx 顶部工具栏与列表空态 */
    toolbar: {
      sort: "排序",
      sortLabel: "排序设置",
      sortLabelCustomized: "排序设置，已自定义",
      display: "显示",
      displayLabel: "卡片显示设置",
      displayLabelCustomized: "卡片显示设置，已自定义",
      filter: "筛选",
      filterWithCount: "筛选 · %{count}",
      filterLabel: "筛选",
      filterLabelWithCount: "筛选，已选 %{count} 项",
      emptyFilteredTitle: "没有符合条件的作品",
      emptyFilteredDescription: "试着放宽筛选条件",
      emptyTitle: "列表是空的",
    },

    /** filter-group.tsx：折叠 / 展开 */
    group: {
      collapse: "收起",
      more: "更多 %{count} 项",
      hiddenSelected: "有已选项被折叠了，展开才能看到",
    },

    /** filter-panel.tsx：筛选面板的分组与底部条 */
    filter: {
      title: "筛选",
      rating: "最低评分",
      votecount: "最少投票数",
      votecountOption: "≥%{min} 票",
      olang: "原语言",
      platform: "平台",
      length: "时长",
      devstatus: "开发状态",
      released: "发行年代",
      releasedOption: "%{year} 起",
      content: "内容完整度",
      hasDescription: "有简介",
      hasScreenshot: "有截图",
      none: "未设置筛选条件",
      selected: "已选 %{count} 项",
      selectedHits: "已选 %{count} 项 · 命中 %{hits} 个",
      /** 无障碍标签 */
      clearAll: "清空全部筛选条件",
    },

    /** filter-summary.tsx：已生效条件的标签 */
    summary: {
      rating: "评分 ≥ %{min}",
      olang: "原语言 %{lang}",
      lang: "语言 %{lang}",
      lengthFallback: "%{hours} 小时",
      releasedRange: "%{from} – %{to}",
      releasedNow: "今",
      votecount: "票数 ≥ %{min}",
      /** 无障碍标签 */
      remove: "移除筛选条件 %{label}",
    },

    /** sort-panel.tsx + sort-options.ts */
    sort: {
      title: "排序",
      field: "排序字段",
      direction: "方向",
      desc: "降序",
      asc: "升序",
      reset: "恢复默认",
      /** 无障碍标签 */
      resetLabel: "恢复默认排序",
      option: {
        votecount: "人气",
        rating: "评分",
        released: "发行日期",
        id: "ID 顺序",
      },
    },

    /** display-panel.tsx：卡片显示字段 */
    display: {
      title: "卡片显示",
      showAll: "全部显示",
      groupLabel: "列表卡片上显示的信息",
      field: {
        rating: "评分",
        released: "发售日期",
        olang: "原语言",
        length: "时长",
        platforms: "平台",
        devstatus: "开发状态",
      },
    },
  },
} as const;
