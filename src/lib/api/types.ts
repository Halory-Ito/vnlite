/**
 * VNDB Kana API 的数据类型。
 *
 * 权威来源：`GET /schema?section=fields`。字段会随 VNDB 更新新增，
 * 遇到「Field 'xxx' not found」时先用 skill 脚本核对 schema 再改这里。
 *
 * ⚠️ 设计要点：Kana **没有字段通配符**，返回内容精确等于请求的 `fields`。
 * 因此每个实体分两套形态：
 *   - `XxxSummary` —— 列表用，字段少、单条 ~221 B
 *   - `XxxDetail`  —— 详情用，字段多
 * 请求哪个就返回哪个，所以不要在列表响应上访问 Detail 字段。
 */

import type {
  CharacterRole,
  ContentLevel,
  DevStatus,
  Language,
  Length,
  ListStatus,
  Medium,
  Platform,
  ProducerType,
  Sex,
  StaffRole,
  Voiced,
} from "./enums";

/* -------------------------------------------------------------------------- */
/* 通用结构                                                                    */
/* -------------------------------------------------------------------------- */

/** 图片 */
export interface Image {
  id?: string;
  url: string;
  dims?: [number, number];
  /** 0 安全 / 1 暗示 / 2 露骨 */
  sexual?: ContentLevel;
  /** 0 安全 / 1 暗示 / 2 露骨 */
  violence?: ContentLevel;
  votecount?: number;
  thumbnail?: string;
  thumbnail_dims?: [number, number];
}

/** 外链（官网 / Steam / DLsite …） */
export interface ExtLink {
  id?: string;
  label: string;
  name: string;
  url: string;
}

/** 标题的多语言变体 */
export interface Title {
  lang: Language;
  title: string;
  latin?: string;
  official?: boolean;
  main?: boolean;
}

/**
 * VN 之间的关系。
 *
 * ⚠️ **结构是平铺的**，不是嵌套在 `vn` 对象里。
 * 正确写法：`relations.id` / `relations.title` / `relations.relation`
 * 写成 `relations.vn.id` 会报 `Invalid 'fields' member: Field 'vn' not found`。
 */
export interface Relation {
  /** 关系类型：`seq` 续作 / `preq` 前传 / `ser` 系列 / `alt` 替代 / `char` 角色 / `parent` 母作 / `side` 番外 */
  relation: string;
  /** 是否为官方承认的关系 */
  relation_official: boolean;
  /** 关系另一端的 VN */
  id: string;
  title: string;
  image?: Image;
  alttitle?: string;
  olang?: Language;
  released?: string;
  rating?: number;
}

/* -------------------------------------------------------------------------- */
/* VN                                                                         */
/* -------------------------------------------------------------------------- */

export interface VnSummary {
  id: string;
  title: string;
  /** 罗马字原名 */
  alttitle?: string;
  titles?: Title[];
  /** 原始语言 */
  olang?: Language;
  released?: string;
  rating?: number;
  votecount?: number;
  length?: Length;
  platforms?: Platform[];
  image?: Image;
  /** 0 完成 / 1 开发中 / 2 已取消。列表字段集已带上（卡片上的「开发中」徽标要用） */
  devstatus?: DevStatus;
}

export interface VnTag {
  id: string;
  name: string;
  category?: string;
  /** 标签在本站用户中的评分，实际会出现 1.5 / 2.5 这类小数值 */
  rating?: number;
  /** 剧透等级 0–2 */
  spoiler?: ContentLevel;
  /** 是否属于「小众 / 未证实」标签 */
  lie?: boolean;
}

export interface VnStaff {
  id: string;
  name: string;
  original?: string;
  /** 在这个 VN 里的职位。⚠️ 只存在于 `/vn` → `staff`，`/staff` 端点本身没这个字段 */
  role?: StaffRole;
  /** 备注，如「CG 绘制助理」 */
  note?: string;
  /** 同职位组内的序号，1 = 主负责 */
  eid?: number | null;
  lang?: Language;
  description?: string;
}

export interface VnDeveloper {
  id: string;
  name: string;
  original?: string;
  type?: ProducerType;
  lang?: Language;
}

export interface VnVaRole {
  note?: string;
  /** 声优。⚠️ `va.staff` 继承 `/staff`，**没有 `role` 字段**（要判断主配角用 `ismain`） */
  staff?: {
    id: string;
    name: string;
    original?: string;
    ismain?: boolean;
    lang?: Language;
    aid?: string;
  };
  character?: { id: string; name: string; original?: string; sex?: Sex[] };
}

export interface VnScreenshot {
  id: string;
  url: string;
  /** 尺寸。⚠️ schema 里没有 `width` / `height`，只有 `dims` */
  dims?: [number, number];
  sexual?: ContentLevel;
  violence?: ContentLevel;
  votecount?: number;
  thumbnail?: string;
  thumbnail_dims?: [number, number];
  release?: { id: string; title: string };
}

export interface VnEdition {
  eid: number;
  lang?: Language;
  name?: string;
  official?: boolean;
}

export interface VnDetail extends VnSummary {
  devstatus?: DevStatus;
  languages?: Language[];
  /** 游戏长度（分钟） */
  length_minutes?: number;
  length_votes?: number;
  description?: string;
  /** 原始均分（0–10），与 `rating`（贝叶斯 10–100）不同 */
  average?: number;
  tags?: VnTag[];
  staff?: VnStaff[];
  developers?: VnDeveloper[];
  va?: VnVaRole[];
  relations?: Relation[];
  screenshots?: VnScreenshot[];
  editions?: VnEdition[];
  extlinks?: ExtLink[];
}

/* -------------------------------------------------------------------------- */
/* Release                                                                    */
/* -------------------------------------------------------------------------- */

export interface Release {
  id: string;
  title: string;
  alttitle?: string;
  released?: string;
  platforms?: Platform[];
  languages?: { lang: Language; title?: string; latin?: string; mtl?: boolean; main?: boolean }[];
  minage?: number;
  patch?: boolean;
  freeware?: boolean;
  uncensored?: boolean;
  official?: boolean;
  has_ero?: boolean;
  voiced?: Voiced;
  engine?: string;
  notes?: string;
  catalog?: string;
  gtin?: string;
  resolution?: "non-standard" | [number, number];
  images?: {
    id?: string;
    type?: string;
    url: string;
    dims?: [number, number];
    sexual?: number;
    violence?: number;
    /** 该图属于哪个 VN / 哪些语言 */
    vn?: string;
    languages?: Language[];
    /** true = 不是扫描图而是照片 */
    photo?: boolean;
  }[];
  media?: { medium: Medium; qty: number }[];
  producers?: {
    developer: boolean;
    publisher: boolean;
    id: string;
    name: string;
    original?: string;
    type?: ProducerType;
  }[];
  /** `rtype` 是该发行版与所属 VN 的关系：`trial` / `partial` / `complete` */
  vns?: { rtype?: string; id: string; title: string; image?: Image }[];
  extlinks?: ExtLink[];
}

/* -------------------------------------------------------------------------- */
/* Producer / Staff                                                           */
/* -------------------------------------------------------------------------- */

export interface Producer {
  id: string;
  name: string;
  original?: string;
  lang?: Language;
  type?: ProducerType;
  description?: string;
  aliases?: string[];
  extlinks?: ExtLink[];
}

/**
 * ⚠️ `/staff` **没有 `image` 字段**（角色才有），也**没有 `sex`**（那是 `/character` 的）。
 * `aliases` 是对象数组而非字符串数组。
 */
export interface Staff {
  id: string;
  name: string;
  original?: string;
  lang?: Language;
  description?: string;
  /** 该 staff 条目是否为「主条目」 */
  ismain?: boolean;
  /** AniDB / AnimeDB 之类的外部 id */
  aid?: string;
  /** 性别（2025 新增） */
  gender?: Sex | null;
  aliases?: { name: string; aid?: string; latin?: string; ismain?: boolean }[];
  extlinks?: ExtLink[];
}

/* -------------------------------------------------------------------------- */
/* Character / Tag / Trait / Quote                                             */
/* -------------------------------------------------------------------------- */

/** ⚠️ `/character` **没有 `extlinks` 字段** */
export interface Character {
  id: string;
  name: string;
  original?: string;
  aliases?: string[];
  description?: string;
  image?: Image;
  /** `[表观性别, 真实性别]` */
  sex?: [Sex | null, Sex | null];
  /** 2025 新增。类型是 `[非剧透, 剧透]`，与 `sex` 语义不同 */
  gender?: [Sex | null, Sex | null];
  blood_type?: string;
  height?: [number, number];
  weight?: [number, number];
  bust?: number;
  waist?: number;
  hips?: number;
  cup?: string;
  age?: [number, number];
  /** [月, 日]，日可为 0 表示只知月份 */
  birthday?: [number, number];
  traits?: {
    id: string;
    name: string;
    /** ⚠️ 在 `/character` → `traits` 上是布尔值，不是数字 */ sexual?: boolean;
    spoiler?: ContentLevel;
    lie?: boolean;
  }[];
  vns?: {
    id: string;
    title: string;
    role?: CharacterRole;
    spoiler?: ContentLevel;
    image?: Image;
    released?: string;
  }[];
}

export interface Tag {
  id: string;
  name: string;
  category?: string;
  description?: string;
  aliases?: string[];
  vn_count?: number;
}

export interface Trait {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  /** ⚠️ schema 里是 `char_count`，不是 `character_count` */
  char_count?: number;
  /** ⚠️ 在 `/trait` 上是布尔值，但在 `/character` → `traits` 上也是布尔值 */
  sexual?: boolean;
  /** 「是否适用」筛选标记 */
  applicable?: boolean;
}

export interface Quote {
  id: string;
  quote: string;
  score?: number;
  vn?: { id: string; title: string; released?: string; image?: Image };
  character?: { id: string; name: string; original?: string };
}

/* -------------------------------------------------------------------------- */
/* 用户清单                                                                    */
/* -------------------------------------------------------------------------- */

export interface UListLabel {
  id: number;
  label: string;
  private?: boolean;
  /** 该标签下的条目数（请求 `fields=count` 时返回） */
  count?: number;
}

export interface UListRelease {
  id: string;
  title: string;
  /** 0 未知 / 1 想要 / 2 已拥有 / 3 借出中 / 4 已删除 */
  list_status?: ListStatus;
  platforms?: Platform[];
  released?: string;
}

export interface UListItem {
  id: string;
  added?: number;
  voted?: number | null;
  lastmod?: number;
  /** 10–100 */
  vote?: number | null;
  started?: string | null;
  finished?: string | null;
  notes?: string | null;
  labels?: UListLabel[];
  releases?: UListRelease[];
  vn?: VnSummary;
}

export interface UserInfo {
  id: string;
  username: string;
}

export interface AuthInfo {
  id: string;
  username: string;
  permissions: string[];
}

/* -------------------------------------------------------------------------- */
/* 查询请求/响应                                                               */
/* -------------------------------------------------------------------------- */

/** 简单谓词：`[字段, 运算符, 值]` */
export type SimplePredicate = readonly [string, string, unknown];

/** 组合谓词首元素 */
export type Predicate =
  | SimplePredicate
  | readonly ["and", ...Predicate[]]
  | readonly ["or", ...Predicate[]];

export interface QueryBody {
  filters?: Predicate | Predicate[];
  fields: string;
  sort?: string;
  reverse?: boolean;
  /** 每页条数，上限 100 */
  results?: number;
  page?: number;
  /** `/ulist` 与 `label` 过滤器需要 */
  user?: string | null;
  /** 开启后返回 `count`，但服务端开销大 */
  count?: boolean;
}

export interface QueryResponse<T> {
  results: T[];
  /** 还有下一页 */
  more: boolean;
  /** 仅在请求 `count: true` 时出现 */
  count?: number;
}

/** 用户清单标签响应 */
export interface UListLabelsResponse {
  labels: UListLabel[];
}

/* -------------------------------------------------------------------------- */
/* 字段名校验                                                                  */
/* -------------------------------------------------------------------------- */

/** 提取类型 T 的顶层字符串键 */
export type TopLevelField<T> = Extract<keyof T, string>;

/**
 * 合法字段字符串的联合类型。
 *
 * Kana 的 fields 支持三种写法，这里全部放开：
 *   `title`              标量
 *   `image.url`          点号取嵌套字段
 *   `image{url,sexual}`  花括号取多个子字段
 *
 * 作用：编译期拦下「Field 'xxx' not found」这类拼写错误（本项目就踩过
 * `staff.sex` —— `sex` 属于 `/character` 而非 `/staff`）。
 * 已知局限：不校验点号之后的子字段名。
 */
export type FieldSpec<T> =
  | TopLevelField<T>
  | `${TopLevelField<T>}.${string}`
  | `${TopLevelField<T>}{${string}}`;

/** 把字段数组拼成 API 需要的逗号分隔字符串 */
export function toFieldsString<T>(fields: readonly FieldSpec<T>[]): string {
  return fields.join(",");
}
