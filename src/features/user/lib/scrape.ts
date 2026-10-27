/**
 * VNDB 用户资料页 HTML 解析（纯函数，可被冒烟直接测）。
 *
 * 为什么抓网页：Kana API 的 `GET /user` **只有 id / username / lengthvotes**，
 * 官网资料页上的注册时间、投票分布、清单规模、论坛统计、近期打分全都拿不到。
 * API 那点数据由 `lib/api/endpoints/ulist#getUser` 负责（目前只用作交叉验证）。
 *
 * 目标页面 `/u{u…}` 的结构：
 *
 * ```html
 * <article class="userpage">
 *   <h1>Yorhel's profile</h1>
 *   <table class="stripe">
 *     <tr><td>Registered</td><td>2007-09-28</td></tr>
 *     <tr><td>Votes</td><td>125 votes, 5.94 average. <a …>Browse votes »</a></td></tr>
 *     <tr><td>List stats</td><td>185 releases of 145 visual novels. …</td></tr>
 *     …
 *   </table>
 * </article>
 * <div class="votestats">
 *   <table class="votegraph">…10..1 每档人数…</table>
 *   <table class="recentvotes stripe">…近期打分…</table>
 * </div>
 * ```
 *
 * ⚠️ 同讨论模块：官网改版就会挂。解析只依赖 `userpage` 表格的行标签、
 * `votegraph` / `recentvotes` 两个表名，失败一律返回 null / 空数组，
 * UI 走空态而不是崩。
 */

import { toText } from "@/lib/scrape/html";

export interface VndbUserTrait {
  /** 特性的**分组**（Hair / Personality / Role …），来自 `class="key"` 那一格 */
  group: string;
  /** 该分组下用户勾选的特性名 */
  names: string[];
}

/** 用户近期给某部作品打的分 */
export interface VndbRecentVote {
  vnId: string;
  title: string;
  /** 原始评分文案（`7` / `8.5` / `10`） */
  score: string;
  /** `YYYY-MM-DD` */
  date: string;
}

export interface VndbUserProfile {
  /** `u2` 这样的用户 id */
  id: string;
  /** 用户名 */
  username: string;
  /** 注册日期 `2007-09-28` */
  registered: string | null;
  edits: number | null;
  /** 投票总数 */
  votes: number | null;
  /** 平均分（保留原始精度，如 `5.94`） */
  votesAverage: string | null;
  /** 总游戏时长，如 `170h39m` */
  playtime: string | null;
  /** 参与统计的通关次数 */
  playthroughs: number | null;
  /** 清单里的发行版数 */
  listReleases: number | null;
  /** 清单里的作品数 */
  listVns: number | null;
  /** 写的评价数 */
  reviews: number | null;
  /** 论坛发帖数 */
  posts: number | null;
  /** 发起的主题数 */
  threads: number | null;
  traits: VndbUserTrait[];
  /** 打分分布，10 分 → 1 分 */
  voteDistribution: { score: number; count: number }[];
  recentVotes: VndbRecentVote[];
}

const USER_ID_RE = /\/u(\d+)/;
/** 「Play times」的值里夹着 `<span class="small">39m</span>`，所以按原始 HTML 取 */
const PLAYTIME_RE = /(\d+)h\s*<span class="small">(\d+)m<\/span>/;

/** 从 `(\d+)` / `([\d.]+)` 里取第一个数字；`null` 表示没匹配到 */
function num(source?: string | null): number | null {
  const match = source?.match(/(\d+)/);
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** 资料页 `<article class="userpage">` 里那一堆 `<tr><td>标签</td><td>值</td></tr>` */
function profileRows(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  const start = html.indexOf('<article class="userpage"');
  const scoped = start >= 0 ? html.slice(start, start + 20_000) : html;

  for (const row of scoped.matchAll(
    /<tr><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([\s\S]*?)<\/td><\/tr>/g
  )) {
    const label = toText(row[1] ?? "");
    if (label !== "") rows.set(label, toText(row[2] ?? ""));
  }
  return rows;
}

/** 解析用户资料页。拿不到基本身份信息就返回 null（UI 显示空态） */
export function parseUserProfile(html: string, id: string): VndbUserProfile | null {
  // 页面上本来就有 `/u数字` 链接；拿不到就用传入的 id 兜底
  const userId = html.match(USER_ID_RE)?.[1] ?? id.replace(/^u/, "");
  // ⚠️ `Username` 那一格是 `<td class="key">`，其余行是裸 `<td>` —— 都用 `[^>]*` 兜住
  const name = html.match(/<td[^>]*>Username<\/td><td[^>]*>([\s\S]*?)<\/td>/)?.[1];
  const username = name ? toText(name).replace(/\s*\(.*$/, "") : "";
  if (!userId || username === "") return null;

  const rows = profileRows(html);
  const votes = rows.get("Votes") ?? "";
  const playRaw = html.match(/<td[^>]*>Play times<\/td><td[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? "";
  const listStats = rows.get("List stats") ?? "";
  const forum = rows.get("Forum stats") ?? "";

  return {
    id: `u${userId}`,
    username,
    registered: rows.get("Registered") ?? null,
    edits: num(rows.get("Edits")),
    votes: num(votes),
    votesAverage: votes.match(/([\d.]+)\s+average/)?.[1] ?? null,
    playtime: playRaw.match(PLAYTIME_RE)
      ? `${playRaw.match(PLAYTIME_RE)?.[1]}h${playRaw.match(PLAYTIME_RE)?.[2]}m`
      : null,
    playthroughs: num(playRaw.match(/from\s+(\d+)\s+playthroughs/)?.[1] ?? null),
    listReleases: num(listStats.match(/(\d+)\s+releases/)?.[1] ?? null),
    listVns: num(listStats.match(/of\s+(\d+)\s+visual novels/)?.[1] ?? null),
    reviews: num(rows.get("Reviews")),
    posts: num(forum.match(/(\d+)\s+posts/)?.[1] ?? null),
    threads: num(forum.match(/(\d+)\s+new threads/)?.[1] ?? null),
    traits: parseTraits(html),
    voteDistribution: parseVoteDistribution(html),
    recentVotes: parseRecentVotes(html),
  };
}

/**
 * 特性行：`<tr><td class="key"><a href="/i1">Hair</a></td><td><a …>Ahoge</a>…</td></tr>`
 * 值里全是 `/i数字` 链接，取链接文字即可。
 */
function parseTraits(html: string): VndbUserTrait[] {
  const traits: VndbUserTrait[] = [];
  for (const row of html.matchAll(
    /<tr><td class="key"><a href="\/i\d+"[^>]*>([\s\S]*?)<\/a><\/td><td>([\s\S]*?)<\/td><\/tr>/g
  )) {
    const names = [...(row[2] ?? "").matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => toText(m[1] ?? ""))
      .filter((name) => name !== "");
    if (names.length > 0) traits.push({ group: toText(row[1] ?? ""), names });
  }
  return traits;
}

/** 打分分布：`<tr><td class="number">10</td><td class="graph">…<div …></div>3</td></tr>` */
function parseVoteDistribution(html: string): { score: number; count: number }[] {
  const start = html.indexOf('<table class="votegraph">');
  const scoped = start >= 0 ? html.slice(start, start + 4000) : "";
  const rows: { score: number; count: number }[] = [];

  for (const row of scoped.matchAll(
    /<td class="number">(\d+)<\/td><td class="graph">[\s\S]*?<div[^>]*>\s*<\/div>(\d+)<\/td>/g
  )) {
    rows.push({ score: Number(row[1]), count: Number(row[2]) });
  }
  return rows;
}

/** 近期打分：`<tr><td><a href="/v4936"…>标题</a></td><td>7</td><td>2026-01-03</td></tr>` */
function parseRecentVotes(html: string): VndbRecentVote[] {
  const start = html.indexOf('<table class="recentvotes stripe">');
  const scoped = start >= 0 ? html.slice(start, start + 8000) : "";
  const votes: VndbRecentVote[] = [];

  for (const row of scoped.matchAll(
    /<tr><td><a href="\/v(\d+)"[^>]*>([\s\S]*?)<\/a><\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g
  )) {
    votes.push({
      vnId: `v${row[1]}`,
      title: toText(row[2] ?? ""),
      score: toText(row[3] ?? ""),
      date: toText(row[4] ?? ""),
    });
  }
  return votes;
}

/* -------------------------------------------------------------------------- */
/* 游玩时长                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 一次游玩记录（`/u2/lengthvotes`）。
 *
 * ⚠️ `/ulist` **没有游玩时长字段** —— API 只能给 `started` / `finished` 两个日期。
 * 真正的「这作打了 9 小时」只存在于官网的用户时长页，所以这里照旧抓 HTML。
 */
export interface VndbLengthVote {
  vnId: string;
  title: string;
  /** 官网原始时长文案，如 `9h14m` / `36m` */
  time: string;
  /** 通关速度：`Fast` / `Normal` / `Slow`（官网英文原名） */
  speed: string | null;
  /** 记录日期 `YYYY-MM-DD` */
  date: string | null;
}

/** `9h<span class="small">14m</span>` → `9h14m`；`36m` → `36m` */
function joinTime(html: string): string | null {
  const hours = html.match(/(\d+)h/);
  const minutes = html.match(/<span class="small">(\d+)m<\/span>/) ?? html.match(/(\d+)m/);
  if (!hours && !minutes) return null;
  const joined = `${hours?.[1] ? `${hours[1]}h` : ""}${minutes?.[1] ? `${minutes[1]}m` : ""}`;
  return joined === "" ? null : joined;
}

/**
 * 解析 `/u{用户id}/lengthvotes`。
 *
 * 行形状：`<td>2025-06-03</td><td><a href="/v47172"…>标题</a></td>
 * <td>9h<span class="small">14m</span></td><td>Normal</td><td>…</td><td>备注</td>`
 * —— 表头那行没有 `/v数字` 链接，会自然被跳过。
 */
export function parseLengthVotes(html: string): VndbLengthVote[] {
  const start = html.indexOf('<table class="stripe">');
  const scoped = start >= 0 ? html.slice(start, start + 20_000) : "";
  const entries: VndbLengthVote[] = [];

  for (const row of scoped.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...(row[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1] ?? "");
    if (cells.length < 4) continue;
    const vn = cells[1]?.match(/<a href="\/v(\d+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!vn) continue;

    entries.push({
      vnId: `v${vn[1]}`,
      title: toText(vn[2] ?? ""),
      time: joinTime(cells[2] ?? "") ?? "",
      speed: toText(cells[3] ?? "") || null,
      date: toText(cells[0] ?? "") || null,
    });
  }
  return entries;
}
