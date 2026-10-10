/**
 * 简体中文 · discussion 模块（讨论板列表 / 帖子正文）。
 *
 * 接入点：`features/discussion/components/vn-discussions-tab`、`thread-screen`。
 * 帖子正文（`post-content`）复用 core 的 `review.spoilerHidden`；
 * 帖子标题 / 用户名 / 正文来自 VNDB 抓取，是**数据**，不在这里翻译。
 */
export const zhDiscussion = {
  discussion: {
    /** 昵称链接的读屏文案（列表与楼层共用） */
    openUser: "打开用户页：%{name}",

    /** features/discussion/components/vn-discussions-tab */
    list: {
      loading: "抓取讨论列表…",
      emptyTitle: "该作品暂无讨论",
      emptyDescription: "VNDB 讨论板上还没有相关话题",
      openThread: "打开讨论帖：%{title}",
      starter: "发起自",
      lastPost: "最后回复",
      replies: "回复",
    },

    /** features/discussion/components/thread-screen */
    thread: {
      title: "讨论帖",
      loading: "抓取帖子…",
      emptyTitle: "这个帖子没有内容",
      emptyDescription: "VNDB 可能改版导致解析失败",
      postCount: "共 %{count} 楼",
      anonymous: "已注销用户",
      edited: "编辑于 %{date}",
    },
  },
} as const;
