/**
 * 角色 / 制作者 / staff / 标签 / 特性 端点。
 */

import { MAX_RESULTS_PER_PAGE } from "@/constants/config";

import { api } from "../client";
import {
  CHARACTER_DETAIL_FIELDS,
  CHARACTER_LIST_FIELDS,
  PRODUCER_DETAIL_FIELDS,
  PRODUCER_LIST_FIELDS,
  STAFF_DETAIL_FIELDS,
  STAFF_LIST_FIELDS,
  TAG_DETAIL_FIELDS,
  TAG_LIST_FIELDS,
  TRAIT_DETAIL_FIELDS,
  TRAIT_LIST_FIELDS,
} from "../fields";
import { and, byTag, pred, vnWithCharacter, vnWithDeveloper, vnWithStaff } from "../filters";
import {
  toFieldsString,
  type Character,
  type Predicate,
  type Producer,
  type QueryResponse,
  type Staff,
  type Tag,
  type Trait,
} from "../types";

/* -------------------------------------------------------------------------- */
/* Character                                                                  */
/* -------------------------------------------------------------------------- */

export function queryCharacters(
  options: {
    filters?: Predicate | Predicate[];
    sort?: "id" | "name" | "searchrank";
    reverse?: boolean;
    results?: number;
    page?: number;
    count?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<QueryResponse<Character>> {
  return api.query<Character>(
    "/character",
    {
      filters: options.filters,
      fields: toFieldsString(CHARACTER_LIST_FIELDS),
      sort: options.sort ?? "id",
      reverse: options.reverse ?? false,
      results: Math.min(options.results ?? 25, MAX_RESULTS_PER_PAGE),
      page: options.page ?? 1,
      count: options.count,
    },
    { signal: options.signal }
  );
}

export function getCharacter(id: string, signal?: AbortSignal): Promise<QueryResponse<Character>> {
  return api.query<Character>(
    "/character",
    {
      filters: ["and", ["id", "=", id]],
      fields: toFieldsString(CHARACTER_DETAIL_FIELDS),
      results: 1,
    },
    { signal }
  );
}

export function getCharacters(
  ids: readonly string[],
  signal?: AbortSignal
): Promise<QueryResponse<Character>> {
  if (ids.length === 0) return Promise.resolve({ results: [], more: false });
  if (ids.length > MAX_RESULTS_PER_PAGE)
    throw new RangeError(`getCharacters 最多 ${MAX_RESULTS_PER_PAGE} 个 id`);
  return api.query<Character>(
    "/character",
    {
      filters: ["or", ...ids.map((id) => ["id", "=", id] as const)],
      fields: toFieldsString(CHARACTER_LIST_FIELDS),
      results: ids.length,
    },
    { signal }
  );
}

/** 某角色出演的 VN */
export function queryVnsByCharacter(
  characterId: string,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/vn",
    {
      /*
       * ⚠️ 这里必须用 `vnWithCharacter`（`/vn` 的 `character` 嵌套）。
       * 曾经错写成 `characterInVn` —— 那是 `/character` 端点的 `vn` 过滤器，
       * 放到 `/vn` 上就是 `400 Invalid 'vn' filter: Unknown field`，
       * 角色详情页的「登场作品」整块显示不出来。
       */
      filters: vnWithCharacter(characterId),
      fields: "id,title,released,rating,image.url,image.sexual,image.violence",
      sort: "released",
      reverse: true,
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

/** 某制作者参与的作品（`/vn` 的 `developer` 嵌套过滤器） */
export function queryVnsByDeveloper(
  producerId: string,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/vn",
    {
      filters: vnWithDeveloper(producerId) as Predicate,
      fields:
        "id,title,alttitle,olang,released,rating,votecount,length,platforms,image.url,image.sexual,image.violence",
      sort: "rating",
      reverse: true,
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

/* -------------------------------------------------------------------------- */
/* Producer                                                                   */
/* -------------------------------------------------------------------------- */

export function queryProducers(
  options: {
    filters?: Predicate | Predicate[];
    search?: string;
    sort?: "id" | "name" | "searchrank";
    reverse?: boolean;
    results?: number;
    page?: number;
    count?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<QueryResponse<Producer>> {
  return api.query<Producer>(
    "/producer",
    {
      filters: options.search ? and(pred("search", "=", options.search)) : options.filters,
      fields: toFieldsString(PRODUCER_LIST_FIELDS),
      sort: options.sort ?? "searchrank",
      reverse: options.reverse ?? false,
      results: Math.min(options.results ?? 25, MAX_RESULTS_PER_PAGE),
      page: options.page ?? 1,
      count: options.count,
    },
    { signal: options.signal }
  );
}

export function getProducer(id: string, signal?: AbortSignal): Promise<QueryResponse<Producer>> {
  return api.query<Producer>(
    "/producer",
    {
      filters: ["and", ["id", "=", id]],
      fields: toFieldsString(PRODUCER_DETAIL_FIELDS),
      results: 1,
    },
    { signal }
  );
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export function queryStaff(
  options: {
    filters?: Predicate | Predicate[];
    search?: string;
    sort?: "id" | "name" | "searchrank";
    results?: number;
    page?: number;
    count?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<QueryResponse<Staff>> {
  return api.query<Staff>(
    "/staff",
    {
      filters: options.search ? and(pred("search", "=", options.search)) : options.filters,
      fields: toFieldsString(STAFF_LIST_FIELDS),
      sort: options.sort ?? "searchrank",
      results: Math.min(options.results ?? 25, MAX_RESULTS_PER_PAGE),
      page: options.page ?? 1,
      count: options.count,
    },
    { signal: options.signal }
  );
}

export function getStaff(id: string, signal?: AbortSignal): Promise<QueryResponse<Staff>> {
  return api.query<Staff>(
    "/staff",
    {
      filters: ["and", ["id", "=", id]],
      fields: toFieldsString(STAFF_DETAIL_FIELDS),
      results: 1,
    },
    { signal }
  );
}

/** 某 staff 参与的作品（`/vn` 的 `staff` 嵌套过滤器，覆盖全部职责） */
export function queryVnsByStaff(
  staffId: string,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/vn",
    {
      filters: vnWithStaff(staffId) as Predicate,
      fields:
        "id,title,alttitle,olang,released,rating,votecount,length,platforms,image.url,image.sexual,image.violence",
      sort: "rating",
      reverse: true,
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

/* -------------------------------------------------------------------------- */
/* Tag / Trait                                                                */
/* -------------------------------------------------------------------------- */

export function queryTags(
  options: {
    filters?: Predicate | Predicate[];
    search?: string;
    sort?: "id" | "name" | "searchrank" | "vn_count";
    reverse?: boolean;
    results?: number;
    page?: number;
    count?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<QueryResponse<Tag>> {
  return api.query<Tag>(
    "/tag",
    {
      filters: options.search ? and(pred("search", "=", options.search)) : options.filters,
      fields: toFieldsString(TAG_LIST_FIELDS),
      sort: options.sort ?? "vn_count",
      reverse: options.reverse ?? true,
      results: Math.min(options.results ?? 25, MAX_RESULTS_PER_PAGE),
      page: options.page ?? 1,
      count: options.count,
    },
    { signal: options.signal }
  );
}

export function getTag(id: string, signal?: AbortSignal): Promise<QueryResponse<Tag>> {
  return api.query<Tag>(
    "/tag",
    {
      filters: ["and", ["id", "=", id]],
      fields: toFieldsString(TAG_DETAIL_FIELDS),
      results: 1,
    },
    { signal }
  );
}

/** 按 id 批量取标签，筛选器面板要一次拿到多个标签名 */
export function getTags(ids: readonly string[], signal?: AbortSignal): Promise<QueryResponse<Tag>> {
  if (ids.length === 0) return Promise.resolve({ results: [], more: false });
  if (ids.length > MAX_RESULTS_PER_PAGE)
    throw new RangeError(`getTags 最多 ${MAX_RESULTS_PER_PAGE} 个 id`);
  return api.query<Tag>(
    "/tag",
    {
      filters: ["or", ...ids.map((id) => ["id", "=", id] as const)],
      fields: toFieldsString(TAG_LIST_FIELDS),
      results: ids.length,
    },
    { signal }
  );
}

/** 标签下的 VN（`tag` 含父标签继承，`dtag` 只取直接标签） */
export function queryVnsByTagId(
  tagId: string,
  direct: boolean,
  signal?: AbortSignal
): Promise<QueryResponse<unknown>> {
  return api.query(
    "/vn",
    {
      filters: byTag(tagId, { direct }),
      fields: "id,title,released,rating,votecount,image.url,image.sexual,image.violence",
      sort: "rating",
      reverse: true,
      results: MAX_RESULTS_PER_PAGE,
    },
    { signal }
  );
}

export function queryTraits(
  options: {
    filters?: Predicate | Predicate[];
    search?: string;
    sort?: "id" | "name" | "searchrank" | "character_count";
    reverse?: boolean;
    results?: number;
    page?: number;
    signal?: AbortSignal;
  } = {}
): Promise<QueryResponse<Trait>> {
  return api.query<Trait>(
    "/trait",
    {
      filters: options.search ? and(pred("search", "=", options.search)) : options.filters,
      fields: toFieldsString(TRAIT_LIST_FIELDS),
      sort: options.sort ?? "character_count",
      reverse: options.reverse ?? true,
      results: Math.min(options.results ?? 25, MAX_RESULTS_PER_PAGE),
      page: options.page ?? 1,
    },
    { signal: options.signal }
  );
}

export function getTrait(id: string, signal?: AbortSignal): Promise<QueryResponse<Trait>> {
  return api.query<Trait>(
    "/trait",
    {
      filters: ["and", ["id", "=", id]],
      fields: toFieldsString(TRAIT_DETAIL_FIELDS),
      results: 1,
    },
    { signal }
  );
}
