/**
 * ⚠️ 已被 `scripts/sync-awards-csv.ts` 取代 —— 大赏数据统一以仓库根的
 * `award-data.csv` 为源（覆盖 2003–2023 全部部门）。本脚本保留用于从
 * Getchu 原始页面复核；直接跑会覆盖 `getchu.json`。
 *
 * 生成 `src/features/awards/lib/getchu.json` —— 美少女ゲーム大賞（Getchu 年度投票）。
 *
 * ## 数据源
 *
 * `https://www.getchu.com/pc/{年}_g_ranking/{部门}.html`（Getchu 的年度总选）。
 * 部门体系 2010 年起定型为 8 个：総合 / シナリオ / システム / グラフィック /
 * ミュージック / ムービー / キャラクター / エロ，各年页面 URL 一致；
 * 更早（2009 及以前）部门还带 ロープライス 且版式又变，不收。范围 2010–2023
 * （Getchu 2024 年停止服务，数据就到 2023）。
 *
 * 页面有年龄门：请求带 `?gc=gc`（「すすむ」链接的参数）即过。
 * 编码是 EUC-JP；本机直连会被重置连接 —— 走本地代理，用环境变量
 * `GETCHU_PROXY` 指定（如 `http://127.0.0.1:7890`），没配则直连尝试。
 *
 * ## 两种版式
 *
 * - 2023（新）：`<div class="vote_num[2]">N位. <a href="...id=X">标题(品牌)</A></div>`
 * - 2010 上下（旧）：`【N位】 … <a href="...id=X">标题</a>（<a>品牌</a>）`
 *   两套都扫一遍，同一名次取标题更长的那个。
 *
 * ## VNDB 对接
 *
 * 作品链接带 `?id=`，这是 Getchu 自己的 id，不能直连 VNDB —— 标题仍走
 * Kana 的 `search` 匹配。解析缓存键：角色部门取『』里的作品名（一个作品
 * 多个角色的行能合到一次查询），其余取去括号后的标题。全表跨部门共享缓存，
 * 同一作品只查一次。
 *
 * ```bash
 * GETCHU_PROXY=http://127.0.0.1:7890 bun run sync:getchu-awards
 * ```
 */

const OUTPUT = "src/features/awards/lib/getchu.json";
const BASE = "https://www.getchu.com/pc";

/** Getchu 编辑端：环境变量 `SYNC_PROXY`（如 `http://127.0.0.1:7890`），没配则直连 */
const PROXY = process.env.SYNC_PROXY ?? "";
const API = "https://api.vndb.org/kana/vn";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

/** 年份范围（Getchu 2024 停服） */
const YEARS: number[] = [];
for (let y = 2023; y >= 2010; y--) YEARS.push(y);

/** 部门清单：id → 页面文件（総合是 index.html），保持 UI 显示顺序 */
const DEPTS: readonly (readonly [string, string])[] = [
  ["total", "index.html"],
  ["scenario", "scenario.html"],
  ["system", "system.html"],
  ["graphic", "graphic.html"],
  ["music", "music.html"],
  ["movie", "movie.html"],
  ["chara", "chara.html"],
  ["eros", "eros.html"],
];
type Dept = (typeof DEPTS)[number][0];
/** 部门在输出里的顺序 */
const DEPT_ORDER: Record<string, number> = Object.fromEntries(DEPTS.map(([id], i) => [id, i]));

/**
 * 个别标题与 VNDB 结构性对不上（末尾带零售版式词 / VNDB 标题结构不同 /
 * Kana 搜索对特殊符号分不出来），变体兜底修不过来，显式映射。
 * 键是 `searchKey` 处理过的标题，值用 Kana 查过确认收益；值也可以是 null
 * （VNDB 没有对应条目，行保持不可点，别错指到别的作品）。
 */
const VN_OVERRIDES: Readonly<Record<string, string | null>> = {
  "D.C.4 Fortunate Departures": "v29066",
  同級生リメイク: "v34136",
  "黒獣（クロイヌ）2": "v23464",
  "戦国†恋姫X ～乙女絢爛☆戦国絵巻～": "v13188",
  "Dies irae（ディエス・イレ） ～Amantes amentes～": "v548",
  "fortissimo EXS//Akkord：nachsten Phase（フォルテシモ エグゼス アコルト：ネクステン ファーゼ）(La’cryma（ラクリマ）)":
    "v7595",
  "無限煉姦～恥○にまみれし不死姫の輪舞～": "v8311",
  ランス10: "v20802",
  "ランス9 ヘルマン革命": "v13802",
  "彼女は高天に祈らない -quantum girlfriend-": "v7067",
  "彼女（ヒロイン）は友達ですか？恋人ですか？それともトメフレですか？": "v25124",
  "彼女（ヒロイン）は友達ですか？恋人ですか？それともトメフレですか？ Second": "v29865",
  // normalize 会把 ＋ 剥掉，撞上《アマカノ2》初代 —— 显式指到 + 作
  "アマカノ2＋": "v31813",
};

/**
 * 行级覆盖：整行原文（`searchKey` 之前）直接映射。用于引用结构与作品语义
 * 对不上的单行 —— Getchu 2014 角色部门第 1 位的锚点原文把主作与 FD 文案
 * 拼在一起（`桜小路 ルナ ～『月に寄りそう乙女の作法』桜小路ルナ アフター
 * アフターストーリーより`），引号里的主作名不能当键（会把同键的其他行带偏），
 * VNDB 又没有 FD 的独立条目 → 置 null。
 */
const ROW_OVERRIDES: Readonly<Record<string, string | null>> = {
  "桜小路 ルナ ～『月に寄りそう乙女の作法』桜小路ルナ アフターアフターストーリーより": null,
};

interface GetchuEntry {
  year: number;
  dept: Dept;
  /** 名次（1 起） */
  rank: number;
  /** 展示标题：角色部门是「角色名 ～『作品名』より」，其余是作品名 */
  title: string;
  /** 品牌（角色部门拿不到，空串） */
  brand: string;
  /** VNDB 作品 id；匹配不到是 null */
  vnId: string | null;
}

/** 用 bun 的 fetch：配了代理直接走（直连必然 reset），没配则直连 */
async function got(url: string): Promise<Response> {
  if (PROXY) return fetch(url, { headers: { "User-Agent": UA }, proxy: PROXY });
  return fetch(url, { headers: { "User-Agent": UA } });
}

/* -------------------------------------------------------------------------- */
/* 页面解析                                                                     */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * 新版式：`N位. <a>标题</a>`。
 * 标题锚点通常是 `soft.phtml`（2023 式 / 作品部门），但角色部门的标题锚点是
 * `chara_XX.html#charaNN`（角色介绍页），作品 id 在下方 500 字内的图片链接上——
 * 所以标题取锚点文本，id 单独从后方的 soft.phtml 拿。
 */
function parseModern(html: string): RawEntry[] {
  return [
    ...html.matchAll(
      /class="vote_num2?"[^>]*>\s*(\d{1,2})\s*位\s*\.?\s*<a[^>]*>([^<]{1,160})<\/a>[\s\S]{0,500}?soft\.phtml\?id=(\d+)/gi
    ),
  ].map((m) => ({ rank: Number(m[1]), id: m[3]!, label: clean(m[2]!), brand: "" }));
}

/** 旧版式：【N位】 + 链接，品牌是标题链接后面紧跟的 `（<a>品牌</a>）` */
function parseLegacy(html: string): RawEntry[] {
  return [
    ...html.matchAll(
      /【\s*(\d{1,2})\s*位\s*】[\s\S]{0,500}?soft\.phtml\?id=(\d+)"[^>]*>([^<]+)<\/a>/gi
    ),
  ].map((m) => {
    const index = (m.index ?? 0) + m[0].length;
    const tail = html.slice(index, index + 120);
    return { rank: Number(m[1]), id: m[2]!, label: clean(m[3]!), brand: brandFromTail(tail) };
  });
}

interface RawEntry {
  rank: number;
  id: string;
  label: string;
  brand: string;
}

/** `（<a ...>品牌</a>）` 或 `（品牌）`，紧跟在标题链接后；其他内容不打扰 */
function brandFromTail(tail: string): string {
  const m = tail.match(/^\s*[（(](?:<[\s\S]{0,200}?>([^<]*)<\/a>)?[）)]/);
  return m?.[1] ? clean(m[1]) : "";
}

/**
 * 新版式标题带品牌后缀（`标题(ブランド)`）：末尾的括号块拆成品牌。
 * 角色部门没有品牌后缀，原样保留。
 */
function splitModern(label: string): { title: string; brand: string } {
  const m = label.match(/^(.*\S)\s*[（(]([^（）、]{1,50})[）)]$/);
  if (!m) return { title: label, brand: "" };
  return { title: m[1]!.trim(), brand: m[2]!.trim() };
}

interface ParsedItem {
  rank: number;
  title: string;
  brand: string;
}

/** 一页部门 → 名次列表（两套版式并扫，同一名次取标题更长的） */
function parseEntries(html: string): ParsedItem[] {
  const byRank = new Map<number, ParsedItem>();
  const put = (rank: number, raw: RawEntry): void => {
    const { title, brand } = splitModern(raw.label);
    const existing = byRank.get(rank);
    if (existing && existing.title.length >= title.length) return;
    byRank.set(rank, { rank, title, brand: brand || raw.brand });
  };
  for (const entry of [...parseLegacy(html), ...parseModern(html)]) put(entry.rank, entry);
  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}

/* -------------------------------------------------------------------------- */
/* VNDB 匹配                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 归一化（判定包含关系用）：先去波浪号（两种波浪线 NFKC 行为不同，
 * 不统一会在 NFKC 后不对齐），再 NFKC 折叠全角数字 / 字母 / 符号，
 * 最后小写 + 去标点 / 符号 / 空白。
 */
function normalize(text: string): string {
  return text
    .replace(/[〜～]/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

function titlesMatch(wanted: string, vnTitle: string, alttitle: string | null): boolean {
  const want = normalize(wanted);
  for (const candidate of [vnTitle, alttitle ?? ""]) {
    const n = normalize(candidate);
    if (!n) continue;
    if (n === want) return true;
    if (want.includes(n) && n.length >= 4) return true;
    if (n.includes(want) && want.length >= 4) return true;
  }
  return false;
}

/** 两种波浪号互转：Getchu 常用 〜 (U+301C)，VNDB 常见 ～ (U+FF5E)，反之亦然 */
function swapWave(text: string): string {
  return text.replace(/[〜～]/g, (w) => (w === "〜" ? "～" : "〜"));
}

/**
 * Kana `search` 查作品 id。search 必须包在 and 里（Kana 的坑见 smoke:api）。
 */
async function searchVn(key: string): Promise<string | null> {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: ["and", ["search", "=", key]],
      fields: "id,title,alttitle",
      sort: "searchrank",
      results: 5,
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    results?: { id: string; title: string; alttitle?: string | null }[];
  };
  for (const item of body.results ?? []) {
    if (titlesMatch(key, item.title, item.alttitle ?? null)) return item.id;
  }
  return null;
}

const cache = new Map<string, string | null>();

/**
 * 给 VNDB 搜的作品名：角色行是「角色名 ～『作品名』より」（新年份，2014+）
 * /「角色名 （注音）～「作品名」より」（老年份）—— 取『』/「」里的内容；
 * 「角色名（作品名）」型（2025 角色部门）不在这里拆，resolveVnId 的
 * 变体兜底会尝试末尾括号的内容。其余原样，trim 后作为键。
 */
function searchKey(title: string): string {
  const quoted = title.match(/[『「]([^』」]+)/)?.[1]?.trim();
  if (quoted) return quoted;
  return title.trim();
}

async function resolveVnId(title: string): Promise<string | null> {
  // 整行级覆盖优先（ROW_OVERRIDES 注释里的原因）
  const rowHit = ROW_OVERRIDES[title];
  const key = searchKey(title);
  if (rowHit !== undefined) {
    cache.set(key, rowHit);
    return rowHit;
  }
  if (cache.has(key)) return cache.get(key)!;
  // 结构性错位的标题直接走显式映射（见 VN_OVERRIDES 注释）
  const overridden: string | null | undefined = VN_OVERRIDES[key];
  if (overridden !== undefined) {
    cache.set(key, overridden);
    return overridden;
  }
  /**
   * 变体：原样 → 波浪号互换 → 括号去掉（旧页正文夹了补充语）→ 末词去掉
   * → 末尾括号里的内容（`朝倉音夢（D.C. Re:tune …）` 型角色行）。
   */
  const parenInner = key.match(/[（(]([^（()）]{4,80})[）)]\s*$/)?.[1]?.trim();
  const variants = [
    ...new Set(
      [key, swapWave(key), parenInner ?? ""].flatMap((base) => [
        base,
        base.replace(/[（(][^）)]*[）)]/g, "").trim(),
        base.replace(/\s+\S+$/, "").trim(),
        swapWave(base.replace(/[（(][^）)]*[）)]/g, "").trim()),
      ])
    ),
  ].filter(Boolean);
  let vnId: string | null = null;
  for (const variant of variants) {
    if (cache.has(variant)) {
      vnId = cache.get(variant)!;
      if (vnId) break;
      continue;
    }
    vnId = await searchVn(variant);
    cache.set(variant, vnId);
    if (vnId) {
      cache.set(key, vnId);
      break;
    }
    await sleep(350);
  }
  if (!vnId) cache.set(key, null);
  return vnId;
}

/* -------------------------------------------------------------------------- */
/* 主流程                                                                      */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const entries: GetchuEntry[] = [];
  let failed = 0;

  for (const [dept, file] of DEPTS) {
    for (const year of YEARS) {
      const url = `${BASE}/${year}_g_ranking/${file}?gc=gc`;
      let html: string | null = null;
      try {
        const response = await got(url);
        html =
          response.status === 200
            ? new TextDecoder("euc-jp").decode(await response.arrayBuffer())
            : null;
        if (!html) console.warn(`  ${dept}/${year}: HTTP ${response.status}`);
      } catch (error) {
        console.warn(`  ${dept}/${year}: 抓取失败 ${String(error)}`);
      }
      if (!html) {
        failed++;
        continue;
      }
      const parsed = parseEntries(html);
      if (parsed.length === 0) {
        console.warn(`  ${dept}/${year}: 没解析到条目（版式？）`);
        failed++;
        continue;
      }
      for (const item of parsed) {
        entries.push({
          year,
          dept: dept as Dept,
          rank: item.rank,
          title: item.title,
          brand: item.brand,
          vnId: null,
        });
      }
      console.log(`  ${dept}/${year}: ${parsed.length} 条`);
      await sleep(500);
    }
  }

  // VNDB 匹配：缓存跨部门 / 跨年份共享，同一作品只查一次
  const unique = [...new Set(entries.map((e) => searchKey(e.title)))];
  console.log(`条目 ${entries.length} 条，去重后待解析 ${unique.length} 个标题`);
  for (const title of unique) {
    await resolveVnId(title);
    await sleep(150);
  }
  for (const entry of entries) entry.vnId = cache.get(searchKey(entry.title)) ?? null;

  if (entries.length === 0) {
    console.error("一条都没抓到，放弃写入");
    process.exit(1);
  }

  // 排序：年份降序 → 部门按清单顺序 → 名次升序
  entries.sort(
    (a, b) => b.year - a.year || DEPT_ORDER[a.dept] - DEPT_ORDER[b.dept] || a.rank - b.rank
  );
  await Bun.write(OUTPUT, `${JSON.stringify(entries, null, 2)}\n`);
  const matched = entries.filter((e) => e.vnId).length;
  console.log(`写入 ${entries.length} 条（${matched} 条有 VNDB id，失败页 ${failed}）→ ${OUTPUT}`);
}

await main();
