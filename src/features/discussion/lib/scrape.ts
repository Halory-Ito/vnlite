/**
 * VNDB 讨论帖 HTML 解析（纯函数，可被冒烟直接测）。
 *
 * 为什么是抓网页：Kana API **没有讨论 / 帖子端点**（`/thread` 等全部 404），
 * 官方文档的端点表里也没有；讨论数据只存在于网站 HTML。经 Master 确认后
 * 采用抓取方案。
 *
 * 目标页面是讨论板列表 `/t/{vndbid}[?p=N]`，正文结构是：
 *
 * ```html
 * <table class="stripe">
 *   <thead><tr><td class="tc1">Topic</td>…</tr></thead>
 *   <tr>
 *     <td class="tc1"><a href="/t24217">标题</a><span class="boards">…</span></td>
 *     <td class="tc2">7</td>
 *     <td class="tc3"><a href="/u322786">发起人</a></td>
 *     <td class="tc4"><a href="/u297579">最后回复者</a> @ <a href="/t24217.10#last">2026-09-29 at 18:12</a></td>
 *   </tr>
 * </table>
 * ```
 *
 * ⚠️ 这是**官网改版就会挂**的脆弱方案（Master 知情）。所以：解析只依赖
 * `tc1`–`tc4` 这几个列 class 与 `/t数字` `/u数字` 链接形状，其余一律不碰；
 * 任何一步失败都返回空列表 / `hasMore=false`，让 UI 走空态而不是崩。
 *
 * 实体解码 / 去标签 / 挑战页识别这些共用逻辑在 `@/lib/scrape/html`。
 */

import { decodeEntities, toText } from "@/lib/scrape/html";

/** 一条讨论帖（列表级信息，不含正文） */
export interface VndbThread {
  /** 形如 `t24217`，可直接拼 `https://vndb.org/t24217` */
  id: string;
  title: string;
  /** 回复数 */
  replies: number;
  /** 发起人用户名 */
  starter: string | null;
  /** 发起人 id（`u322786`），给「用户页」跳转用 */
  starterId: string | null;
  /** 最后回复者用户名 */
  lastPoster: string | null;
  /** 最后回复者 id */
  lastPosterId: string | null;
  /** 最后回复时间，官网原始文案如 `2026-09-29 at 18:12` */
  lastPost: string | null;
}

export interface ThreadListPage {
  threads: VndbThread[];
  /** 页面还有下一页（`rel="next"`） */
  hasMore: boolean;
}

const TITLE_RE = /<td class="tc1"><a href="\/t(\d+)"[^>]*>([\s\S]*?)<\/a>/;
const REPLIES_RE = /<td class="tc2">(\d+)<\/td>/;
const STARTER_RE = /<td class="tc3">([\s\S]*?)<\/td>/;
const LAST_RE = /<td class="tc4">([\s\S]*?)<\/td>/;

/** 解析讨论板列表 HTML。解析不到表格时返回空页（不抛） */
export function parseThreadList(html: string): ThreadListPage {
  const threads: VndbThread[] = [];

  // 全页按 <tr> 切，只认「tc1 里挂着 /t数字 链接」的行，绕开表格边界与表头
  for (const row of html.split(/<tr[^>]*>/)) {
    const title = row.match(TITLE_RE);
    if (!title) continue;

    const lastCell = row.match(LAST_RE)?.[1] ?? "";
    const lastLinks = [...lastCell.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
      toText(m[1] ?? "")
    );
    const starterCell = row.match(STARTER_RE)?.[1] ?? "";
    // 用户 id 从 `/u数字` 链接里取（作者名显示的是用户名，id 才是跳转用的）
    const starterId = starterCell.match(/href="\/u(\d+)"/)?.[1] ?? null;
    const lastPosterId = lastCell.match(/href="\/u(\d+)"/)?.[1] ?? null;
    const starter = starterId
      ? toText(starterCell.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "")
      : null;

    threads.push({
      id: `t${title[1]}`,
      title: toText(title[2] ?? ""),
      replies: Number.parseInt(row.match(REPLIES_RE)?.[1] ?? "0", 10) || 0,
      starter: starter || null,
      starterId: starterId ? `u${starterId}` : null,
      lastPoster: lastLinks[0] || null,
      lastPosterId: lastPosterId ? `u${lastPosterId}` : null,
      lastPost: lastLinks[1] || null,
    });
  }

  return { threads, hasMore: /rel="next"/.test(html) };
}

/* -------------------------------------------------------------------------- */
/* 帖子正文                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 帖子正文的一小段：只映射 VNDB 帖子实际会出现的标记
 * （`<br>` / `<a>` / `<em>` / `<strong>` / `<span class=underline>` /
 * `<div class=quote>` / 剧透块），其余标签当透明容器或直接丢弃。
 *
 * `id` 由解析器按出现顺序分配 —— 渲染时用它当 React key
 * （节点树渲染期内不变，但 lint 不允许拿数组下标当 key）。
 */
interface NodeBase {
  id: number;
}

export type PostNode =
  | ({ type: "text"; text: string } & NodeBase)
  | ({ type: "br" } & NodeBase)
  | ({ type: "bold"; children: PostNode[] } & NodeBase)
  | ({ type: "italic"; children: PostNode[] } & NodeBase)
  | ({ type: "underline"; children: PostNode[] } & NodeBase)
  | ({ type: "link"; href: string; children: PostNode[] } & NodeBase)
  | ({ type: "quote"; children: PostNode[] } & NodeBase)
  | ({ type: "spoiler"; children: PostNode[] } & NodeBase);

/** 一个楼层 */
export interface VndbPost {
  /** 楼层号（帖子内的序号，如 14） */
  number: number;
  /** 作者用户名；已删除用户时为 null */
  author: string | null;
  /** 作者用户 id（`u2`），可拼用户页；已删除时为 null */
  authorId: string | null;
  /** 发帖时间，官网原始文案如 `2010-12-23 at 09:31` */
  date: string | null;
  /** 最后编辑时间（有才给） */
  lastmod: string | null;
  /** 正文节点树 */
  content: PostNode[];
}

export interface ThreadPage {
  title: string | null;
  posts: VndbPost[];
  /** 还有下一页（`rel="next"`；每页 25 楼，URL 是 `/t950/2`） */
  hasMore: boolean;
}

interface Frame {
  nodes: PostNode[];
  tag: string;
  /** 处于该帧时忽略一切内容（用于丢弃 `<small>` 里的 report/edit 行） */
  skip: boolean;
}

/** 把一段正文 HTML 解析成节点树。任何未知标签按透明容器处理 */
export function parsePostNodes(html: string): PostNode[] {
  const root: PostNode[] = [];
  const stack: Frame[] = [{ nodes: root, tag: "", skip: false }];
  let nextId = 0;
  const nodeId = (): number => nextId++;

  const top = (): Frame => stack[stack.length - 1] as Frame;
  const pushText = (raw: string): void => {
    const frame = top();
    if (frame.skip || raw === "") return;
    // HTML 语义：连续空白折叠成一个空格
    const text = decodeEntities(raw).replace(/\s+/g, " ");
    if (text !== "") frame.nodes.push({ id: nodeId(), type: "text", text });
  };
  const pushContainer = (
    kind: "bold" | "italic" | "underline" | "link" | "quote" | "spoiler",
    tag: string,
    href?: string
  ): void => {
    const frame = top();
    const children: PostNode[] = [];
    if (!frame.skip) {
      const node =
        kind === "link"
          ? ({ id: nodeId(), type: "link", href: href ?? "", children } as PostNode)
          : ({ id: nodeId(), type: kind, children } as PostNode);
      frame.nodes.push(node);
    }
    stack.push({ nodes: children, tag, skip: frame.skip });
  };
  const closeTo = (tag: string): void => {
    for (let i = stack.length - 1; i >= 1; i -= 1) {
      if (stack[i]?.tag === tag) {
        stack.length = i;
        return;
      }
    }
  };

  let cursor = 0;
  while (cursor < html.length) {
    const lt = html.indexOf("<", cursor);
    if (lt < 0) {
      pushText(html.slice(cursor));
      break;
    }
    pushText(html.slice(cursor, lt));
    const gt = html.indexOf(">", lt);
    if (gt < 0) break;
    const raw = html.slice(lt + 1, gt).trim();
    cursor = gt + 1;

    if (raw === "" || raw.startsWith("!")) continue;
    if (raw.startsWith("/")) {
      closeTo(raw.slice(1).trim().toLowerCase().split(/\s/)[0] ?? "");
      continue;
    }

    const name = (raw.match(/^[a-zA-Z][a-zA-Z0-9]*/)?.[0] ?? "").toLowerCase();
    if (!name) continue;
    const attrs = raw.slice(name.length);
    const cls = (attrs.match(/class="([^"]*)"/i)?.[1] ?? "").toLowerCase();

    if (name === "br") {
      if (!top().skip) top().nodes.push({ id: nodeId(), type: "br" });
      continue;
    }
    // report / edit 行整段丢弃；`lastmod` 由 parseThreadPage 单独取
    if (name === "small") {
      stack.push({ nodes: [], tag: name, skip: true });
      continue;
    }
    if (cls.includes("spoiler")) {
      pushContainer("spoiler", name);
      continue;
    }
    if (name === "div" && cls.includes("quote")) {
      pushContainer("quote", name);
      continue;
    }
    if (name === "em" || name === "i") {
      pushContainer("italic", name);
      continue;
    }
    if (name === "strong" || name === "b") {
      pushContainer("bold", name);
      continue;
    }
    if (name === "span" && cls.includes("underline")) {
      pushContainer("underline", name);
      continue;
    }
    if (name === "a") {
      const href = attrs.match(/href="([^"]*)"/i)?.[1];
      if (href) {
        pushContainer("link", name, href);
        continue;
      }
    }
    // 其余标签透明：子内容直接落在当前帧里
    stack.push({ nodes: top().nodes, tag: name, skip: top().skip });
  }

  return root;
}

const POST_CHUNK_RE = /<tr id="p(\d+)">/;
const POST_HEADER_RE = /<td class="tc1">([\s\S]*?)<\/td>/;
const POST_BODY_RE = /<td class="tc2">([\s\S]*?)<\/td>/;
const POST_LASTMOD_RE = /<small class="lastmod">([\s\S]*?)<\/small>/;

/** 解析帖子页 `/t950[/2]`。解析不到时返回空页（不抛） */
export function parseThreadPage(html: string): ThreadPage {
  const title = html.match(/<main>[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1];
  const posts: VndbPost[] = [];

  // split 带捕获组：偶数位是段内容，奇数位是楼层号
  const parts = html.split(POST_CHUNK_RE);
  for (let i = 1; i < parts.length; i += 2) {
    const chunk = parts[i + 1] ?? "";
    const header = chunk.match(POST_HEADER_RE)?.[1] ?? "";
    const byLink = header.match(/by\s+<a href="(\/u\d+)"[^>]*>([\s\S]*?)<\/a>/);
    const byName = header.match(/by\s+([^<]+)/);
    const body = chunk.match(POST_BODY_RE)?.[1] ?? "";
    const lastmod = body.match(POST_LASTMOD_RE)?.[1];

    posts.push({
      number: Number.parseInt(parts[i] ?? "0", 10) || 0,
      author: byLink ? toText(byLink[2] ?? "") : byText(byName?.[1]),
      authorId: byLink?.[1]?.replace("/", "") ?? null,
      date: toText(header.match(/<br\s*\/?>([\s\S]*)$/)?.[1] ?? "") || null,
      lastmod: lastmod
        ? (toText(lastmod).match(/(\d{4}-\d{2}-\d{2} at \d{2}:\d{2})/)?.[1] ?? null)
        : null,
      content: parsePostNodes(body),
    });
  }

  return {
    title: title ? toText(title) : null,
    posts,
    hasMore: /rel="next"/.test(html),
  };
}

/** 取用户名的兜底：纯文本形式的 `by xxx` */
function byText(raw: string | undefined): string | null {
  const text = toText(raw ?? "");
  const name = text.replace(/^by\s+/i, "").trim();
  return name === "" ? null : name;
}
