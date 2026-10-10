/**
 * 各端点的字段选择集。
 *
 * 为什么不用通配符：Kana API **不支持** `image.*` 之类的通配符，且选太多字段
 * 会触发 `Too much data selected`。所以列表与详情必须各有一套。
 *
 * 三个硬规则（违反即 400）：
 *   1. 对象型字段必须显式给子字段 —— `image` 不行，`image.url` 或 `image{url,sexual}` 才行
 *   2. 标量数组可直接选 —— `platforms`、`languages`、`aliases` 不用写子字段
 *   3. 嵌套只有一层时用点号连续写合法 —— `image.url,titles.lang` 等价于 `image{url},titles{lang}`
 */

import type {
  AuthInfo,
  Character,
  FieldSpec,
  Producer,
  Quote,
  Release,
  Staff,
  Tag,
  Trait,
  UListItem,
  VnDetail,
  VnSummary,
} from "./types";

/* -------------------------------------------------------------------------- */
/* VN                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * VN 列表字段。
 * 实测 100 条 = 22,140 B（≈221 B/条），带 tags 会涨到 6,534 B/条 —— 列表页绝不选 tags。
 *
 * `image.thumbnail`（256×362）给列表小图用，详情页大图才用 `image.url`；
 * `devstatus` 是列表行上「开发中 / 停止开发」徽标的来源（原来漏了，徽标永远不显示）。
 */
export const VN_LIST_FIELDS = [
  "id",
  "title",
  "alttitle",
  "olang",
  "devstatus",
  "released",
  "rating",
  "votecount",
  "length",
  "platforms",
  "image.url",
  "image.thumbnail",
  "image.sexual",
  "image.violence",
] as const satisfies readonly FieldSpec<VnSummary>[];

/**
 * 首页横向封面墙的字段集（`queryUpcomingVns` / `queryJustReleasedVns`）。
 *
 * 只要「封面 + 名称」：id（跳转）+ title + 缩略图。
 * 刻意**不要** `image.url`（原图几十 KB，列表里用不上）、`released`（不显示日期）、
 * `rating`（未发售作品没有分），也别用 `VN_LIST_FIELDS` —— 那是带卡片信息行的列表字段。
 */
export const VN_COVER_CARD_FIELDS = [
  "id",
  "title",
  "image.thumbnail",
  "image.sexual",
  "image.violence",
] as const satisfies readonly FieldSpec<VnSummary>[];

/** VN 详情全字段（实测单条 ~8–20 KB） */
export const VN_DETAIL_FIELDS = [
  "id",
  "title",
  "alttitle",
  "titles.lang",
  "titles.title",
  "titles.official",
  "titles.main",
  "olang",
  "devstatus",
  "released",
  "languages",
  "platforms",
  "length",
  "length_minutes",
  "length_votes",
  "description",
  "rating",
  "votecount",
  "developers.id",
  "developers.name",
  "image.url",
  "image.dims",
  "image.thumbnail",
  "image.sexual",
  "image.violence",
  "image.votecount",
  "tags.id",
  "tags.name",
  "tags.category",
  "tags.rating",
  "tags.spoiler",
  "tags.lie",
  "staff.id",
  "staff.name",
  "staff.original",
  "staff.role",
  "staff.note",
  "staff.eid",
  "developers.id",
  "developers.name",
  "developers.original",
  "developers.type",
  "va.note",
  "va.staff.id",
  "va.staff.name",
  "va.staff.original",
  "va.staff.ismain",
  "va.character.id",
  "va.character.name",
  "va.character.original",
  "va.character.sex",
  "relations.relation",
  "relations.relation_official",
  "relations.id",
  "relations.title",
  "relations.alttitle",
  "relations.released",
  "relations.image.url",
  "screenshots.id",
  "screenshots.url",
  "screenshots.thumbnail",
  "screenshots.dims",
  "screenshots.sexual",
  "screenshots.violence",
  "screenshots.votecount",
  "editions.eid",
  "editions.lang",
  "editions.name",
  "editions.official",
  "extlinks.id",
  "extlinks.label",
  "extlinks.name",
  "extlinks.url",
] as const satisfies readonly FieldSpec<VnDetail>[];

/* -------------------------------------------------------------------------- */
/* Release                                                                    */
/* -------------------------------------------------------------------------- */

export const RELEASE_LIST_FIELDS = [
  "id",
  "title",
  "alttitle",
  "released",
  "platforms",
  "minage",
  "patch",
  "freeware",
  "uncensored",
  "voiced",
] as const satisfies readonly FieldSpec<Release>[];

export const RELEASE_DETAIL_FIELDS = [
  ...RELEASE_LIST_FIELDS,
  "languages.lang",
  "languages.title",
  "languages.latin",
  "languages.main",
  "official",
  "has_ero",
  "engine",
  "notes",
  "catalog",
  "gtin",
  "resolution",
  "media.medium",
  "media.qty",
  "images.id",
  "images.type",
  "images.url",
  "images.dims",
  "images.sexual",
  "images.violence",
  "producers.developer",
  "producers.publisher",
  "producers.id",
  "producers.name",
  "producers.original",
  "producers.type",
  "extlinks.id",
  "extlinks.label",
  "extlinks.name",
  "extlinks.url",
] as const satisfies readonly FieldSpec<Release>[];

/* -------------------------------------------------------------------------- */
/* Producer / Staff                                                           */
/* -------------------------------------------------------------------------- */

export const PRODUCER_LIST_FIELDS = [
  "id",
  "name",
  "original",
  "lang",
  "type",
] as const satisfies readonly FieldSpec<Producer>[];

export const PRODUCER_DETAIL_FIELDS = [
  ...PRODUCER_LIST_FIELDS,
  "description",
  "aliases",
  "extlinks.id",
  "extlinks.label",
  "extlinks.name",
  "extlinks.url",
] as const satisfies readonly FieldSpec<Producer>[];

export const STAFF_LIST_FIELDS = [
  "id",
  "name",
  "original",
  "lang",
  "ismain",
] as const satisfies readonly FieldSpec<Staff>[];

/** ⚠️ `/staff` 没有 `image`，也没有 `sex`（那是 `/character` 的） */
export const STAFF_DETAIL_FIELDS = [
  ...STAFF_LIST_FIELDS,
  "description",
  "aid",
  "gender",
  "aliases.name",
  "aliases.aid",
  "aliases.latin",
  "aliases.ismain",
  "extlinks.id",
  "extlinks.label",
  "extlinks.name",
  "extlinks.url",
] as const satisfies readonly FieldSpec<Staff>[];

/* -------------------------------------------------------------------------- */
/* Character / Tag / Trait / Quote                                             */
/* -------------------------------------------------------------------------- */

export const CHARACTER_LIST_FIELDS = [
  "id",
  "name",
  "original",
  "image.url",
  "image.sexual",
  "image.violence",
] as const satisfies readonly FieldSpec<Character>[];

export const CHARACTER_DETAIL_FIELDS = [
  ...CHARACTER_LIST_FIELDS,
  "description",
  "aliases",
  "sex",
  "gender",
  "blood_type",
  "age",
  "bust",
  "waist",
  "hips",
  "cup",
  "height",
  "weight",
  "birthday",
  "traits.id",
  "traits.name",
  "traits.sexual",
  "traits.spoiler",
  "traits.lie",
] as const satisfies readonly FieldSpec<Character>[];

export const TAG_LIST_FIELDS = [
  "id",
  "name",
  "category",
  "vn_count",
] as const satisfies readonly FieldSpec<Tag>[];

export const TAG_DETAIL_FIELDS = [
  ...TAG_LIST_FIELDS,
  "description",
  "aliases",
] as const satisfies readonly FieldSpec<Tag>[];

export const TRAIT_LIST_FIELDS = [
  "id",
  "name",
  "sexual",
  "char_count",
] as const satisfies readonly FieldSpec<Trait>[];

export const TRAIT_DETAIL_FIELDS = [
  ...TRAIT_LIST_FIELDS,
  "description",
  "aliases",
] as const satisfies readonly FieldSpec<Trait>[];

export const QUOTE_LIST_FIELDS = [
  "id",
  "quote",
  "score",
  "vn.id",
  "vn.title",
  "vn.released",
  "character.id",
  "character.name",
  "character.original",
] as const satisfies readonly FieldSpec<Quote>[];

/* -------------------------------------------------------------------------- */
/* 用户                                                                        */
/* -------------------------------------------------------------------------- */

export const USER_LIST_FIELDS = ["id", "username", "lengthvotes"] as const;

/** `GET /authinfo` 固定返回这三个字段，传入的 fields 会被忽略 */
export const AUTH_INFO_FIELDS = [
  "id",
  "username",
  "permissions",
] as const satisfies readonly FieldSpec<AuthInfo>[];

/**
 * `/ulist` 行字段。
 * `vn` 子对象刻意只取列表级字段，避免清单页拉全量详情撑爆 `Too much data selected`。
 *
 * ⚠️ `vn.id` **请求了也不会返回**：它与顶层 `id` 相同，VNDB 会省略（实测）。
 * 需要用 VN id 时一律取 `UListItem.id`；拿 `vn.id` 拼路由会得到 `/ulist/undefined`
 * （真事故：编辑页 `400 Invalid 'id' filter`，见 `UlistItemRow` 的注释）。
 */
export const ULIST_FIELDS = [
  "id",
  "added",
  "voted",
  "lastmod",
  "vote",
  "started",
  "finished",
  "notes",
  "labels.id",
  "labels.label",
  "releases.id",
  "releases.title",
  "releases.list_status",
  "releases.platforms",
  "releases.released",
  "vn.id",
  "vn.title",
  "vn.alttitle",
  "vn.olang",
  "vn.released",
  "vn.rating",
  "vn.votecount",
  "vn.length",
  "vn.image.url",
  "vn.image.sexual",
  "vn.image.violence",
] as const satisfies readonly FieldSpec<UListItem>[];

/**
 * 别人清单里的**投票记录**字段（用户详情页「全部投票」列表用）。
 *
 * 比 `ULIST_FIELDS` 瘦得多：只要作品名、评分、投票时间与起止日期。
 * 不要封面 —— 这一列列表一次就是上百条，省下来能少传一大截；
 * 不要 `notes` —— 评论性内容不该出现在别人资料页里。
 *
 * ⚠️ 刻意**不列** `vn.id`：与顶层 `id` 相同的字段 VNDB 会省略（请求了也不返回，
 * 见上面 `ULIST_FIELDS` 的说明）。导航一律用 `UListItem.id`。
 */
export const USER_VOTE_FIELDS = [
  "id",
  "vote",
  "voted",
  "started",
  "finished",
  "vn.title",
] as const satisfies readonly FieldSpec<UListItem>[];

/**
 * `/ulist` 统计字段（收藏统计页用）。
 *
 * 只取聚合真正需要的三样：发售年份（`vn.released`）、厂商（`vn.developers`）、
 * 清单标签（`labels`），外加 `vote`（平均分）。刻意不要 image / notes ——
 * 统计页不渲染条目列表，别为用不到的字段付流量与解析开销。
 */
export const ULIST_STATS_FIELDS = [
  "id",
  "vote",
  "labels.id",
  "labels.label",
  "vn.released",
  "vn.developers.id",
  "vn.developers.name",
] as const satisfies readonly FieldSpec<UListItem>[];

/**
 * `/ulist` 的「游戏类型」字段（收藏统计的类型分布用）。
 *
 * 只取 `vn.tags.id`：类型靠本地跟一份固定的类型标签清单比对（见 `statsLogic`），
 * 不需要标签名 —— 但**这一趟载荷很重**（约 1.2 KB/条，实测 100 条 = 121 KB），
 * 所以单独一个查询，别拖慢其他统计图。
 */
export const ULIST_TAG_FIELDS = [
  "id",
  "vn.tags.id",
] as const satisfies readonly FieldSpec<UListItem>[];

/**
 * 记录统计 · 游玩时长排名 / 类型时长分布用。
 *
 * 只取作品名与类型标签 id（类型靠本地固定清单比对，见 `stats/play-stats-logic`）。
 * 入参是本地游玩记录里去重后的 vnId —— 数量可控，一次（或分块几次）就能取回。
 */
export const VN_PLAY_INFO_FIELDS = [
  "id",
  "title",
  "tags.id",
] as const satisfies readonly FieldSpec<VnSummary>[];
