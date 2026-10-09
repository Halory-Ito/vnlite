/**
 * queryKeys 工厂。
 *
 * 集中管理是为了让失效（invalidate）不会漏写。约定：
 *   第 0 段是资源名，第 1 段起是具体标识
 *   `list` / `detail` 分开，便于分别设 staleTime 与精确失效
 */

import type { VnFilterState } from "@/lib/api/filters";

/** 把筛选状态序列化成稳定的 key（对象顺序会影响 key，这里手动排序） */
function normalizeFilters(state: VnFilterState | undefined): string {
  if (!state) return "none";
  return Object.keys(state)
    .sort()
    .map((k) => `${k}=${JSON.stringify((state as Record<string, unknown>)[k])}`)
    .join("&");
}

export const queryKeys = {
  /* ---- VN ---- */
  vn: {
    all: ["vn"] as const,
    list: (filters: VnFilterState | null, sort?: string, page?: number) =>
      ["vn", "list", normalizeFilters(filters ?? undefined), sort ?? "id", page ?? 1] as const,
    detail: (id: string) => ["vn", "detail", id] as const,
    byIds: (ids: readonly string[]) => ["vn", "byIds", [...ids].sort().join(",")] as const,
    releases: (vnId: string) => ["vn", "releases", vnId] as const,
    characters: (vnId: string) => ["vn", "characters", vnId] as const,
    random: (round = 0) => ["vn", "random", round] as const,
  },

  /* ---- 角色 / 制作者 / staff ---- */
  character: {
    all: ["character"] as const,
    list: (search?: string, page?: number) =>
      ["character", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["character", "detail", id] as const,
    vns: (id: string) => ["character", "vns", id] as const,
    byIds: (ids: readonly string[]) => ["character", "byIds", [...ids].sort().join(",")] as const,
  },
  producer: {
    all: ["producer"] as const,
    list: (search?: string, page?: number) =>
      ["producer", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["producer", "detail", id] as const,
  },
  staff: {
    all: ["staff"] as const,
    list: (search?: string, page?: number) => ["staff", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["staff", "detail", id] as const,
    vns: (id: string) => ["staff", "vns", id] as const,
  },

  /* ---- 标签 / 特性 ---- */
  tag: {
    all: ["tag"] as const,
    list: (search?: string, page?: number) => ["tag", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["tag", "detail", id] as const,
    vns: (id: string, direct: boolean) =>
      ["tag", "vns", id, direct ? "direct" : "inherit"] as const,
    byIds: (ids: readonly string[]) => ["tag", "byIds", [...ids].sort().join(",")] as const,
  },
  trait: {
    all: ["trait"] as const,
    list: (search?: string, page?: number) => ["trait", "list", search ?? "", page ?? 1] as const,
    detail: (id: string) => ["trait", "detail", id] as const,
  },

  /* ---- 语录 ---- */
  quote: {
    all: ["quote"] as const,
    /** 每日语录（key 里带本地日期，跨天自动换新） */
    ofTheDay: (dateKey: string) => ["quote", "ofTheDay", dateKey] as const,
    byVn: (vnId: string) => ["quote", "byVn", vnId] as const,
  },

  /* ---- 用户（资料页与时长走抓取，投票记录走 API） ---- */
  user: {
    all: ["user"] as const,
    /** 抓取 VNDB 网站的用户资料页 */
    profile: (userId: string) => ["user", "profile", userId] as const,
    /** 该用户打过分的清单条目（`/ulist?user=…`） */
    votes: (userId: string) => ["user", "votes", userId] as const,
    /** 游玩时长记录（抓 `/u…/lengthvotes`） */
    lengthVotes: (userId: string) => ["user", "lengthvotes", userId] as const,
    /** 搜索页的「用户」档（`GET /user`，只支持精确匹配，见 `findUser`） */
    search: (nameOrId: string) => ["user", "search", nameOrId] as const,
  },

  /* ---- VNDB 数据库统计（全局条目数，与用户清单无关） ---- */
  database: {
    stats: () => ["database", "stats"] as const,
  },

  /* ---- 讨论（抓 VNDB 网站 HTML，不是 Kana API） ---- */
  discussion: {
    all: ["discussion"] as const,
    /** 某作品 / 讨论板的帖子列表 */
    vn: (vnId: string) => ["discussion", "vn", vnId] as const,
    /** 单个讨论帖的正文 */
    thread: (threadId: string) => ["discussion", "thread", threadId] as const,
  },

  /* ---- 用户评价（同样只能抓网站：Kana 没有 reviews 端点） ---- */
  review: {
    all: ["review"] as const,
    /** 最新评价列表（`/w`，首页「最新评价」页签） */
    list: (limit: number) => ["review", "list", limit] as const,
    /** 单条评价详情（`/w18526`，站内评价页） */
    detail: (id: string) => ["review", "detail", id] as const,
  },

  /* ---- 攻略（静态 JSON 仓库，不是 Kana API，见 features/walkthrough） ---- */
  walkthrough: {
    all: ["walkthrough"] as const,
    /** 全部攻略的索引（vid → 文件路径 + 统计）。全应用共用一份 */
    index: () => ["walkthrough", "index"] as const,
    /** 某个作品的单篇攻略 */
    byVn: (vnId: string) => ["walkthrough", "byVn", vnId] as const,
    /** 某个作品的本地标记（已走过 / 重点 / 已达成结局） */
    marks: (vnId: string) => ["walkthrough", "marks", vnId] as const,
  },

  /* ---- 首页信息流 ---- */
  home: {
    all: ["home"] as const,
    /** 即将发售（`released > 今天`，key 带日期：跨天自动重取） */
    upcoming: (day: string) => ["home", "upcoming", day] as const,
    /** 最新发售（`released <= 今天`） */
    justReleased: (day: string) => ["home", "just-released", day] as const,
  },

  /* ---- 用户清单（服务端驱动，不落本地库；标签筛选在本地做） ---- */
  ulist: {
    all: ["ulist"] as const,
    /** 列表页（不带标签过滤 —— 筛选是纯客户端行为，key 固定，换标签不重新请求） */
    list: () => ["ulist", "list"] as const,
    labels: () => ["ulist", "labels"] as const,
    item: (vnId: string) => ["ulist", "item", vnId] as const,
    /** 收藏统计（整份清单的聚合，与列表页分开缓存） */
    stats: () => ["ulist", "stats"] as const,
    /** 收藏统计 · 游戏类型分布（带 tags 的那一趟，单独缓存） */
    statsTypes: () => ["ulist", "statsTypes"] as const,
  },

  /* ---- 账号 ---- */
  account: {
    all: ["account"] as const,
    authInfo: () => ["account", "authinfo"] as const,
    user: (id: string) => ["account", "user", id] as const,
    stats: () => ["account", "stats"] as const,
  },

  /* ---- 浏览历史（本地 SQLite，见 features/history） ---- */
  history: {
    all: ["history"] as const,
    /** `tab` 是展示档位（vn / people / user / producer），start / end 是自定义日期 */
    list: (tab: string, start: string, end: string) =>
      ["history", "list", tab, start, end] as const,
  },

  /* ---- 游玩记录（本地 SQLite，见 features/play-records） ---- */
  playRecords: {
    all: ["playRecords"] as const,
    /** 某作品的全部游玩记录 */
    list: (vnId: string) => ["playRecords", "list", vnId] as const,
  },
} as const;
