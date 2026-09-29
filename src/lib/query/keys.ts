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
    random: () => ["quote", "random"] as const,
    ofTheDay: (dateKey: string) => ["quote", "ofTheDay", dateKey] as const,
    byVn: (vnId: string) => ["quote", "byVn", vnId] as const,
  },

  /* ---- 用户清单（唯一会落盘的业务数据） ---- */
  ulist: {
    all: ["ulist"] as const,
    local: () => ["ulist", "local"] as const,
    remote: (user?: string, page?: number, sort?: string) =>
      ["ulist", "remote", user ?? "me", page ?? 1, sort ?? "added"] as const,
    item: (vnId: string, user?: string) => ["ulist", "item", vnId, user ?? "me"] as const,
    labels: (user?: string) => ["ulist", "labels", user ?? "me"] as const,
  },

  /* ---- 账号 ---- */
  account: {
    all: ["account"] as const,
    authInfo: () => ["account", "authinfo"] as const,
    user: (id: string) => ["account", "user", id] as const,
    stats: () => ["account", "stats"] as const,
    ratingRank: () => ["account", "ratingRank"] as const,
  },
} as const;
