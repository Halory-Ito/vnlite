/**
 * VNDB 用户评价的 HTML 解析（纯函数，可被冒烟直接测）。
 *
 * ## 为什么是抓网页
 *
 * Kana API **没有评价端点**：`/review` 实测 404，官方端点表里也没有，
 * `/vn` 只给一个 `has_review` 布尔过滤器 —— 拿不到正文、作者、分数。
 * 评价数据只存在于网站 HTML（与讨论模块同一个结论）。
 *
 * ## 两个页面
 *
 * 1. 列表 `/w`（Browse reviews，每页 50 条，`rel="next"` 翻页）—— 首页「最新评价」用：
 *
 * ```html
 * <table class="stripe">
 *   <tr>
 *     <td class="tc1">2026-10-01</td>                              <!-- 日期 -->
 *     <td class="tc2"><a href="/u321692">wuite</a></td>             <!-- 作者 + id -->
 *     <td class="tc3">8</td>                                        <!-- 分数 0–10，- = 未打分 -->
 *     <td class="tc4">Short</td>                                   <!-- 通关状态（游玩时长） -->
 *     <td class="tc5"><a href="/w18526" title="…">作品名</a></td>    <!-- 评价 id + 作品名 -->
 *     <td class="tc7">0</td>                                        <!-- 评论数 -->
 *   </tr>
 * </table>
 * ```
 *
 * 2. 详情 `/w18526`（单条评价）—— 站内评价页用，结构是一张 `table.fullreview`：
 *
 * ```html
 * <table class="fullreview">
 *   <tr><td>Subject</td><td><a href="/v27746" title="…">作品名</a>…<a href="/r91675">发行版名</a></td></tr>
 *   <tr><td>By</td><td>…Helpfulness: 0<br /><strong>Vote: 8</strong>…<a href="/u321692">wuite</a> on 2026-10-01</td></tr>
 *   <tr><td>Review</td><td>正文 HTML…</td></tr>
 * </table>
 * ```
 *
 * ⚠️ 这是**官网改版就会挂**的脆弱方案（Master 知情，与讨论模块同一取舍）。
 * 所以解析只依赖上表这几个 `tc1`–`tc7` / `fullreview` 结构与 `/w数字` `/u数字` `/v数字`
 * 链接形状，其余一律不碰；解析不到就返回空 / null，让 UI 走空态而不是崩。
 *
 * 评价正文复用讨论模块的富文本节点树（`parsePostNodes`）—— 同一套 VNDB HTML 富文本，
 * 两处各解析一次迟早对不上。
 */

import { decodeEntities, toText } from "@/lib/scrape/html";
import { parsePostNodes, type PostNode } from "@/features/discussion/lib/scrape";

/* -------------------------------------------------------------------------- */
/* 列表（/w）                                                                  */
/* -------------------------------------------------------------------------- */

/** 一条评价（列表级信息，不含正文） */
export interface VndbReview {
  /** 形如 `w18526`，可直接拼 `https://vndb.org/w18526` */
  id: string;
  /** 发布日期 `YYYY-MM-DD` */
  date: string | null;
  /** 作者用户名 */
  author: string | null;
  /** 作者 id（`u321692`），给站内用户页跳转用 */
  authorId: string | null;
  /** 分数 0–10；`-`（未打分）与解析失败都是 null */
  score: number | null;
  /** 通关状态 / 游玩时长，官网原文（`Short` / `Medium` / `Long` / `Unfinished`） */
  length: string | null;
  /** 作品名（评价挂在某个作品下） */
  title: string;
  /** 评价下的评论数 */
  comments: number;
}

export interface ReviewListPage {
  reviews: VndbReview[];
  /** 还有下一页（`rel="next"`） */
  hasMore: boolean;
}

const DATE_RE = /<td class="tc1">([\s\S]*?)<\/td>/;
const AUTHOR_RE = /<td class="tc2">([\s\S]*?)<\/td>/;
const SCORE_RE = /<td class="tc3">([\s\S]*?)<\/td>/;
const LENGTH_RE = /<td class="tc4">([\s\S]*?)<\/td>/;
const SUBJECT_RE = /<td class="tc5">([\s\S]*?)<\/td>/;
const COMMENTS_RE = /<td class="tc7">([\s\S]*?)<\/td>/;
/** 评价链接：`/w18526`，标题取链接文本（`title` 属性里是原文名） */
const REVIEW_LINK_RE = /<a href="\/w(\d+)"[^>]*>([\s\S]*?)<\/a>/;
/** 用户链接：`/u321692` */
const USER_LINK_RE = /<a href="\/u(\d+)"[^>]*>([\s\S]*?)<\/a>/;

/** 解析评价列表 HTML。解析不到行时返回空页（不抛） */
export function parseReviewList(html: string): ReviewListPage {
  const reviews: VndbReview[] = [];

  // 全页按 <tr> 切，只认「tc5 里挂着 /w数字 链接」的行，绕开表格边界与表头
  for (const row of html.split(/<tr[^>]*>/)) {
    const subject = row.match(SUBJECT_RE)?.[1] ?? "";
    const link = subject.match(REVIEW_LINK_RE);
    if (!link) continue;

    const authorCell = row.match(AUTHOR_RE)?.[1] ?? "";
    const authorLink = authorCell.match(USER_LINK_RE);

    reviews.push({
      id: `w${link[1]}`,
      date: toText(row.match(DATE_RE)?.[1] ?? "") || null,
      author: authorLink ? toText(authorLink[2] ?? "") || null : null,
      authorId: authorLink ? `u${authorLink[1]}` : null,
      score: parseScore(row.match(SCORE_RE)?.[1] ?? ""),
      length: toText(row.match(LENGTH_RE)?.[1] ?? "") || null,
      title: toText(link[2] ?? ""),
      comments: Number.parseInt(toText(row.match(COMMENTS_RE)?.[1] ?? ""), 10) || 0,
    });
  }

  return { reviews, hasMore: /rel="next"/.test(html) };
}

/** 分数列：`-` 表示未打分（不是 0 分） */
function parseScore(cell: string): number | null {
  const n = Number.parseInt(toText(cell), 10);
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/* 作品页的评价（/v17/reviews）                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 作品页「评价」页签的一条。
 *
 * 与列表页 `/w` 的结构**完全不同**：那边是表格，这里是 `<div class="reviews">`
 * 里的 `<article>` 卡片：
 *
 * ```html
 * <div class="reviews"><article>
 *   <div>
 *     <span>Short by <a href="/u154784">succhunter</a> on 2022-04-30</span>
 *     <a href="/r60521">r60521</a>            <!-- 可选：评价针对的发行版 -->
 *     <span>9/10</span>
 *   </div>
 *   <div></div>
 *   <div><span>&lt;<a href="/report/w4208">report</a>></span>正文…<a href="/w4208#review"> Read more »</a></div>
 *   <div><a href="/w4208#threadstart">1 comment</a>…<small> 10 points</small></div>
 * </article>…</div>
 * ```
 *
 * 所以只能另写一套解析；同样只依赖上面这几个形状，认不出就整条丢掉。
 */
export interface VnReviewEntry {
  /** `w4208` */
  id: string;
  author: string | null;
  authorId: string | null;
  /** `YYYY-MM-DD` */
  date: string | null;
  /** 0–10（官网允许一位小数，如 `9.4/10`） */
  score: number | null;
  /** `Short` / `Medium` / `Long` */
  length: string | null;
  /** 正文摘要（纯文本；长评价在「Read more」处截断） */
  excerpt: string;
  /** 有用度（`10 points`） */
  points: number | null;
  /** 评论数 */
  comments: number;
}

/** 卡片头部：`Short by <a>…</a> on 2022-04-30` + 分数 */
const VN_REVIEW_HEADER_RE = /^<div>([\s\S]*?)<\/div>/;
/** 正文：报告链接的 `</span>` 之后，到页脚 div 之前（页脚是 `w… #threadstart` 链接） */
const VN_REVIEW_BODY_RE =
  /<span>&lt;<a href="\/report\/w\d+">report<\/a>><\/span>([\s\S]*?)<\/div>/;

/** 解析作品页的评价列表。解析不到时返回空数组（不抛） */
export function parseVnReviews(html: string): VnReviewEntry[] {
  const start = html.indexOf('<div class="reviews">');
  if (start < 0) return [];

  const entries: VnReviewEntry[] = [];
  const parts = html.slice(start).split("<article>");

  for (const raw of parts.slice(1)) {
    const chunk = raw.split("</article>")[0] ?? "";
    // 评价 id 从「report」链接里取（每张卡片都有）
    const id = chunk.match(/<a href="\/report\/w(\d+)">/)?.[1];
    if (!id) continue;

    const header = chunk.match(VN_REVIEW_HEADER_RE)?.[1] ?? "";
    const headerText = toText(header);
    const authorLink = header.match(USER_LINK_RE);

    entries.push({
      id: `w${id}`,
      author: authorLink ? toText(authorLink[2] ?? "") || null : null,
      authorId: authorLink ? `u${authorLink[1]}` : null,
      date: headerText.match(/\bon\s+(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      score: parseVoteHtml(header),
      length: headerText.match(/^(Short|Medium|Long)\b/)?.[1] ?? null,
      excerpt: excerptOf(chunk.match(VN_REVIEW_BODY_RE)?.[1] ?? ""),
      points: toNumber(chunk.match(/(\d+)\s+points?/)?.[1]),
      comments: toNumber(chunk.match(/(\d+)\s+comments?/)?.[1]) ?? 0,
    });
  }

  return entries;
}

/**
 * `9/10` / `9.4/10` → 9 / 9.4。
 *
 * ⚠️ 必须从**原始 HTML** 里取：`toText` 去标签时不加空格，
 * `…2022-04-30</span><span>9/10` 会粘成 `2022-04-309/10`，
 * 按纯文本匹配会读出 309 分。
 */
function parseVoteHtml(html: string): number | null {
  const raw = html.match(/(\d+(?:\.\d+)?)\s*\/\s*10\s*</)?.[1];
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

/** 正文 HTML → 纯文本摘要（去掉「Read more »」这类链接尾巴） */
function excerptOf(html: string): string {
  const text = toText(html);
  const cut = text.indexOf("Read more");
  return (cut >= 0 ? text.slice(0, cut) : text).trim();
}

/* -------------------------------------------------------------------------- */
/* 详情（/w18526）                                                             */
/* -------------------------------------------------------------------------- */

export interface VndbReviewDetail {
  id: string;
  /** 作品 id（`v27746`）—— 站内能跳作品详情；官网偶尔有没挂作品的评价 */
  vnId: string | null;
  /** 作品名 */
  title: string;
  /** 评价针对的发行版名（`/r` 链接），只是文字：项目里没有发行版详情页 */
  release: string | null;
  /** 平台（`Windows` 等，取自 `abbr[title]`） */
  platforms: string[];
  /** 语言（`Japanese` 等） */
  languages: string[];
  /** 通关状态（`complete` 等） */
  status: string | null;
  author: string | null;
  authorId: string | null;
  date: string | null;
  /** 0–10 */
  score: number | null;
  /** 有用数（`Helpfulness`） */
  helpfulness: number | null;
  /** 正文节点树（复用讨论模块的富文本解析） */
  content: PostNode[];
}

/** 评价页的主表；`fullreview` 是这一页特有的 class */
const FULL_REVIEW_RE = /<table class="fullreview">([\s\S]*?)<\/table>/;

/** 按左侧的标题单元格（`Subject` / `By` / `Review`）取右侧内容 */
function cellOf(table: string, label: string): string {
  const re = new RegExp(`<tr><td>${label}</td><td[^>]*>([\\s\\S]*?)</td></tr>`);
  return table.match(re)?.[1] ?? "";
}

/** 解析单条评价页。页面结构对不上时返回 null（不抛） */
export function parseReviewPage(html: string, id: string): VndbReviewDetail | null {
  const table = html.match(FULL_REVIEW_RE)?.[1];
  if (!table) return null;

  const subject = cellOf(table, "Subject");
  const by = cellOf(table, "By");
  const review = cellOf(table, "Review");

  // 作品：`<a href="/v27746" title="…">作品名</a>`；标题取链接文本
  const vnLink = subject.match(/<a href="\/v(\d+)"[^>]*>([\s\S]*?)<\/a>/);
  // 发行版：`/r` 链接（`/release` 形如 `/r91675`）
  const releaseLink = subject.match(/<a href="\/r(\d+)"[^>]*>([\s\S]*?)<\/a>/);
  const authorLink = by.match(USER_LINK_RE);

  // 平台 / 语言 / 通关状态都藏在 `<abbr title="…">` 里（图标本身没有文字）
  const abbrs = [...subject.matchAll(/<abbr[^>]*title="([^"]*)"/g)].map((m) =>
    decodeEntities(m[1] ?? "")
  );

  return {
    id,
    vnId: vnLink ? `v${vnLink[1]}` : null,
    title: vnLink ? toText(vnLink[2] ?? "") : "",
    release: releaseLink ? toText(releaseLink[2] ?? "") : null,
    platforms: abbrs.filter((t) => PLATFORM_TITLES.has(t)),
    languages: abbrs.filter((t) => LANGUAGE_TITLES.has(t)),
    status: STATUS_TITLES.find((title) => abbrs.includes(title)) ?? null,
    author: authorLink ? toText(authorLink[2] ?? "") || null : null,
    authorId: authorLink ? `u${authorLink[1]}` : null,
    // `… on 2026-10-01`（也可能带时间 `on 2026-10-01 at 03:21`）
    date: by.match(/on\s+(\d{4}-\d{2}-\d{2}(?:[^<]*))?/)?.[1]?.trim() ?? null,
    score: parseScore((by.match(/Vote:?\s*(-|\d+)/)?.[1] ?? "") as string),
    helpfulness: Number.parseInt(by.match(/Helpfulness:?\s*(-|\d+)/)?.[1] ?? "", 10) || 0,
    content: parsePostNodes(review),
  };
}

/**
 * `abbr[title]` 的取值分类。
 *
 * 官网这里给的是**英文**枚举（`Windows` / `Japanese` / `complete`），
 * 不是 Kana 的短码（`win` / `ja` / `rtcomplete`），所以只能靠白名单区分。
 * 认不出的 abbr 一律丢弃 —— 宁可少显示一个图标，也不要把语言和平台混在一起。
 */
const PLATFORM_TITLES = new Set([
  "Windows",
  "Linux",
  "macOS",
  "Web",
  "iOS",
  "Android",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "PlayStation 3",
  "PlayStation 4",
  "PlayStation 5",
  "PlayStation Portable",
  "PlayStation Vita",
  "Xbox 360",
  "Xbox One",
  "Xbox Series X/S",
  "Nintendo 3DS",
  "Nintendo DS",
  "Game Boy Advance",
  "Game Boy Color",
  "Dreamcast",
  "Sega Saturn",
  "Super Famicom",
  "Nintendo Entertainment System",
  "MSX",
  "PC-88",
  "PC-98",
  "X68000",
  "FM Towns",
  "F.M.T.",
  "Other",
]);

const LANGUAGE_TITLES = new Set([
  "English",
  "Japanese",
  "Chinese (simplified)",
  "Chinese (traditional)",
  "Korean",
  "German",
  "French",
  "Spanish",
  "Italian",
  "Portuguese",
  "Russian",
  "Polish",
  "Dutch",
  "Swedish",
  "Ukrainian",
  "Czech",
  "Hungarian",
  "Turkish",
  "Arabic",
  "Hebrew",
  "Persian",
  "Hindi",
  "Indonesian",
  "Malay",
  "Thai",
  "Vietnamese",
  "Bulgarian",
  "Croatian",
  "Estonian",
  "Greek",
  "Latvian",
  "Lithuanian",
  "Romanian",
  "Slovak",
  "Slovenian",
  "Catalan",
  "Basque",
  "Galician",
]);

const STATUS_TITLES = ["complete", "partial", "unfinished"] as const;
