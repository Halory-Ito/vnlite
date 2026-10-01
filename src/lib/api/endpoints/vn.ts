/**
 * 端点封装。
 *
 * 每个函数都是 `lib/api/client.ts` 之上的类型安全薄封装：
 * 默认带好该端点的字段集，调用方只关心筛选与排序。
 */

import { MAX_RESULTS_PER_PAGE } from "@/constants/config";

import { api } from "../client";
import { VN_DETAIL_FIELDS, VN_LIST_FIELDS } from "../fields";
import {
  byTag,
  byVn,
  characterInVn,
  quoteFromCharacter,
  quoteFromVn,
  withSeiyuu,
} from "../filters";
import {
  toFieldsString,
  type Predicate,
  type QueryResponse,
  type Quote,
  type VnDetail,
  type VnSummary,
} from "../types";

export interface VnQueryOptions {
  filters?: Predicate | Predicate[];
  sort?: "id" | "title" | "released" | "rating" | "votecount" | "searchrank";
  reverse?: boolean;
  results?: number;
  page?: number;
  count?: boolean;
  signal?: AbortSignal;
}

const clampResults = (n: number | undefined): number => Math.min(n ?? 25, MAX_RESULTS_PER_PAGE);

/** 通用 VN 查询，列表页用（精简字段） */
export function queryVns(options: VnQueryOptions = {}): Promise<QueryResponse<VnSummary>> {
  return api.query<VnSummary>(
    "/vn",
    {
      filters: options.filters,
      fields: toFieldsString(VN_LIST_FIELDS),
      sort: options.sort ?? "id",
      reverse: options.reverse ?? false,
      results: clampResults(options.results),
      page: options.page ?? 1,
      count: options.count,
    },
    { signal: options.signal }
  );
}

/** VN 详情 */
export function getVn(id: string, signal?: AbortSignal): Promise<QueryResponse<VnDetail>> {
  return api.query<VnDetail>(
    "/vn",
    {
      filters: ["and", ["id", "=", id]],
      fields: toFieldsString(VN_DETAIL_FIELDS),
      results: 1,
    },
    { signal }
  );
}

/** 按 ID 批量取，合并成一次请求（单次上限 100） */
export function getVns(
  ids: readonly string[],
  signal?: AbortSignal
): Promise<QueryResponse<VnSummary>> {
  if (ids.length === 0) return Promise.resolve({ results: [], more: false });
  if (ids.length > MAX_RESULTS_PER_PAGE) {
    throw new RangeError(`getVns 最多 ${MAX_RESULTS_PER_PAGE} 个 id，收到 ${ids.length}`);
  }
  return api.query<VnSummary>(
    "/vn",
    {
      filters: ["or", ...ids.map((id) => ["id", "=", id] as const)],
      fields: toFieldsString(VN_LIST_FIELDS),
      results: ids.length,
    },
    { signal }
  );
}

/** 某 VN 下的全部发行版 */
export function queryReleasesByVn(
  vnId: string,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/release",
    {
      filters: byVn(vnId),
      fields: "id,title,alttitle,released,platforms,minage,patch,freeware,uncensored,voiced",
      sort: "released",
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

/**
 * 某 VN 下的角色。
 *
 * ⚠️ 两个字段坑：
 *   1. `/character` 的 `image` **没有 `thumbnail`**（只有 `/vn` 的 image 有），
 *      带上就是 `400 Field 'thumbnail' not found`，整个请求挂掉
 *   2. 「主角 / 主要 / 次要 / 登场」的分档要用 `vns{id,role}`，不能只取 `image`
 */
export function queryCharactersByVn(
  vnId: string,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/character",
    {
      filters: characterInVn(vnId),
      fields: "id,name,original,image.url,image.sexual,image.violence,sex,vns{id,role}",
      sort: "id",
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

/** 某角色的配音 staff */
export function querySeiyuuByCharacter(
  characterId: string,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/staff",
    {
      filters: andRoleSeiyuu(characterId),
      fields: "id,name,original",
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

function andRoleSeiyuu(characterId: string): Predicate {
  return ["and", withSeiyuu(characterId), ["role", "=", "seiyuu"] as const] as const;
}

/** 某标签下的 VN */
export function queryVnsByTag(
  tagId: string,
  options: VnQueryOptions = {}
): Promise<QueryResponse<VnSummary>> {
  return queryVns({ ...options, filters: ["and", byTag(tagId)] as Predicate });
}

/* -------------------------------------------------------------------------- */
/* 随机                                                                        */
/* -------------------------------------------------------------------------- */

/** 拿不到最大 id 时的兜底（VNDB 的 v-id 只会增长，这个值只会偏保守） */
const FALLBACK_MAX_ID = 70000;

/**
 * 最大 VN id 缓存。
 *
 * 一次会话只问一次：「随机」按钮点几十次也只多花这一个请求。
 * 失败时清掉缓存，避免一次网络抖动把后续所有的随机都钉死。
 */
let maxIdPromise: Promise<number> | null = null;

function getMaxVnId(): Promise<number> {
  maxIdPromise ??= api
    .query<{ id: string }>("/vn", { fields: "id", sort: "id", reverse: true, results: 1 })
    .then((res) => parseVnNumber(res.results[0]?.id) ?? FALLBACK_MAX_ID)
    .catch((error: unknown) => {
      maxIdPromise = null;
      throw error;
    });
  return maxIdPromise;
}

function parseVnNumber(id: string | undefined): number | null {
  const n = Number((id ?? "").replace(/^v/, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 随机取一部 VN。
 *
 * Kana **没有 random 排序**（只有 `/quote` 有 `random=1`），官方推荐的做法是：
 *   1. 取最大 id（缓存住）
 *   2. 在 1..maxId 里随机抽一个数，用 `id >= vN` 拿离它最近的一条
 * 这样是真随机（不是固定池），且一次只花 1–2 个请求。
 *
 * 抽到的号段可能已经被删除 / 不存在（`id >=` 会返回更远的一条，也可能为空），
 * 所以最多重试几次。
 */
export async function queryRandomVn(signal?: AbortSignal): Promise<VnSummary> {
  const maxId = await getMaxVnId();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const n = 1 + Math.floor(Math.random() * maxId);
    const res = await queryVns({
      filters: ["id", ">=", `v${n}`],
      results: 1,
      signal,
    });
    const vn = res.results[0];
    if (vn) return vn;
  }
  throw new Error("随机作品暂时取不到，请稍后再试");
}

/** 随机一条语录（每日语录当天抽一次就用它） */
export function queryRandomQuote(signal?: AbortSignal): Promise<QueryResponse<Quote>> {
  return api.query<Quote>(
    "/quote",
    {
      filters: ["random", "=", 1] as unknown as Predicate,
      fields:
        "id,quote,score,vn.id,vn.title,vn.released,character.id,character.name,character.original",
      results: 1,
    },
    { signal }
  );
}

/** 某 VN / 角色下的语录（按 `score` 降序） */
export function queryQuotes(options: {
  vnId?: string;
  characterId?: string;
  results?: number;
  signal?: AbortSignal;
}): Promise<QueryResponse<Quote>> {
  const filters = options.vnId
    ? quoteFromVn(options.vnId)
    : options.characterId
      ? quoteFromCharacter(options.characterId)
      : undefined;
  return api.query<Quote>(
    "/quote",
    {
      filters,
      fields:
        "id,quote,score,vn.id,vn.title,vn.released,character.id,character.name,character.original",
      sort: "score",
      reverse: true,
      results: clampResults(options.results ?? 25),
    },
    { signal: options.signal }
  );
}
