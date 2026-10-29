/**
 * 生成两份大赏数据 —— 以仓库根目录的 `award-data.csv` 为唯一数据源：
 *
 * - `src/features/awards/lib/awards.json` —— 萌系游戏大赏（萌えゲーアワード）主线层级
 * - `src/features/awards/lib/getchu.json` —— 美少女游戏大赏（Getchu 年度投票）年份 × 部门 × 名次
 *
 * CSV 由萌娘百科两个条目的获奖表整理而来（`award,year,department,prize,title,company,...`），
 * 覆盖 Getchu 2003–2023 的 13 个作品部门与萌系 2006–2026。
 *
 * ## 部门映射
 *
 * CSV 用中文部门名，输出用稳定 id（见 `GETCHU_DEPTS`）。`制作公司部门` 是厂商榜、
 * 不对应作品，直接跳过 —— 没有 vnId 可绑，放进作品列表只会是一串不可点的死行。
 *
 * ## VNDB 对接
 *
 * 优先级：
 * 1. 旧输出文件里同名作品已有的 vnId（按 (年,部门,名次) / 归一化标题复用，重跑不重查）
 * 2. `.tmp-awards-vnid.json` 缓存（跨次运行）
 * 3. Kana `search` 逐条查，标题做变体兜底（去版本后缀 / 去括号 / 按波浪号拆段）
 *
 * 匹配不到的写 null，界面显示为不可点文本。Kana 限流 200 次 / 5 分钟，
 * 首次全量跑约 20 分钟，之后重跑只补新增行。
 *
 * ```bash
 * bun run sync:awards-csv
 * ```
 */

const CSV_PATH = "award-data.csv";
const MOE_OUTPUT = "src/features/awards/lib/awards.json";
const GETCHU_OUTPUT = "src/features/awards/lib/getchu.json";
const CACHE_PATH = ".tmp-awards-vnid.json";
const API = "https://api.vndb.org/kana/vn";

type MoePrize = "grand" | "semi" | "gold" | "silver" | "bronze";

type GetchuDept =
  | "total"
  | "scenario"
  | "system"
  | "graphic"
  | "music"
  | "movie"
  | "chara"
  | "eros"
  | "naming"
  | "voice"
  | "theme"
  | "vocal"
  | "bgm";

interface MoeEntry {
  year: number;
  prize: MoePrize;
  title: string;
  brand: string;
  vnId: string | null;
}

interface GetchuEntry {
  year: number;
  dept: GetchuDept;
  rank: number;
  title: string;
  brand: string;
  vnId: string | null;
}

/** CSV 部门名 → 输出 dept id（顺序即 UI 的 chip 顺序） */
const GETCHU_DEPTS: readonly (readonly [string, GetchuDept])[] = [
  ["综合部门", "total"],
  ["剧本部门", "scenario"],
  ["系统部门", "system"],
  ["作画部门", "graphic"],
  ["音乐部门", "music"],
  ["影片部门", "movie"],
  ["角色部门", "chara"],
  ["工口部门", "eros"],
  ["作品命名部门", "naming"],
  ["配音部门", "voice"],
  ["主题曲部门", "theme"],
  ["Vocal部门", "vocal"],
  ["BGM部门", "bgm"],
];

const DEPT_BY_LABEL = new Map(GETCHU_DEPTS);
const DEPT_ORDER = new Map(GETCHU_DEPTS.map(([, id], index) => [id, index]));

/** CSV 奖项名 → 萌系层级；2006–2008 是单一大赏，CSV 里奖项列为空 */
const MOE_PRIZE: Readonly<Record<string, MoePrize>> = {
  "": "grand",
  大赏: "grand",
  准大赏: "semi",
  金赏: "gold",
  银赏: "silver",
  铜赏: "bronze",
};

const MOE_PRIZE_ORDER: Record<MoePrize, number> = {
  grand: 0,
  semi: 1,
  gold: 2,
  silver: 3,
  bronze: 4,
};

/**
 * 萌娘百科的年度列混用了「颁奖年」和「公布年」：2026 年度的 `AiComi`
 * 就是官网 2025 年度的「アイコミ」（ILLGAMES），按官网口径归到 2025。
 */
const MOE_YEAR_FIX: Readonly<Record<number, number>> = { 2026: 2025 };

/* -------------------------------------------------------------------------- */
/* CSV                                                                         */
/* -------------------------------------------------------------------------- */

interface CsvRow {
  award: string;
  year: string;
  department: string;
  prize: string;
  title: string;
  company: string;
  note: string;
}

/** 最小 CSV 解析：支持引号包裹 / 双引号转义 / 引号内换行 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

async function loadRows(): Promise<CsvRow[]> {
  const text = await Bun.file(CSV_PATH).text();
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error("CSV 是空的");
  const index = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
  return body.map((cells) => ({
    award: cells[index.award!] ?? "",
    year: cells[index.year!] ?? "",
    department: cells[index.department!] ?? "",
    prize: cells[index.prize!] ?? "",
    title: cells[index.title!] ?? "",
    company: cells[index.company!] ?? "",
    note: cells[index.note!] ?? "",
  }));
}

/* -------------------------------------------------------------------------- */
/* VNDB 匹配                                                                   */
/* -------------------------------------------------------------------------- */

/** 归一化：小写 + 去掉所有标点 / 符号 / 空白，波浪号先抹平 */
function normalize(text: string): string {
  return text
    .replace(/[〜～]/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

const swapWave = (text: string): string =>
  text.replace(/[〜～]/g, (w) => (w === "〜" ? "～" : "〜"));

/** CSV 里的零售版 / 限定版后缀，查 VNDB 前剥掉 */
const RETAIL_SUFFIX =
  /\s*(DVD[\s-]*(?:ROM|specification|版|パッケージ)?|期间限定感谢ぱっく|期間限定感謝ぱっく|Complete Edition|complete edition)\s*$/i;

function titleVariants(title: string): string[] {
  const base = title.trim();
  const stripped = base.replace(RETAIL_SUFFIX, "").replace(RETAIL_SUFFIX, "").trim();
  const noParens = stripped.replace(/[（(][^）)]*[）)]/g, "").trim();
  const segments = stripped
    .split(/[〜～]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
  return [...new Set([base, stripped, noParens, swapWave(stripped), ...segments].filter(Boolean))];
}

/** 标题匹配：归一化后完全相等，或较长一方包含另一方（短串不参与包含） */
function titlesMatch(wanted: string, vnTitle: string, alttitle: string | null): boolean {
  const want = normalize(wanted);
  if (!want) return false;
  for (const candidate of [vnTitle, alttitle ?? ""]) {
    const norm = normalize(candidate);
    if (!norm) continue;
    if (norm === want) return true;
    if (want.includes(norm) && norm.length >= 4) return true;
    if (norm.includes(want) && want.length >= 4) return true;
  }
  return false;
}

/**
 * 中文标题在 VNDB 别名词库里查不到、`search` 直接空结果的，显式映射。
 * 每一条都用 Kana 查过：核对过发售年份与厂商，避免把同系列作品指错。
 * 值用 null 表示确认 VNDB 没有对应条目（行保持不可点，别乱指）。
 */
const VN_OVERRIDES: Readonly<Record<string, string | null>> = {
  "11eyes-罪与罚与救赎之少女-": "v729",
  "ef - the latter tale.": "v88",
  "スマガ -STAR MINE GIRL-": "v648",
  "星空的记忆 -流星下的愿景-": "v1474",
  "初音岛2 P.S.P.": "v266",
  染红的街道: "v547",
  "圣娜鲁卡娜-永远神剑物语2-": "v26",
  超昂闪忍遥: "v284",
  混沌头脑: "v382",
  "姬狩Dungeon Meister": "v1195",
  茜色的画布2: "v174",
  筑巢之龙: "v1086",
  白色呼吸: "v478",
  最终试验鲸鱼: "v78",
  最终试验鲨鱼: "v78",
  "银河天使：永恒的情人": "v862",
  "你所期望的永远 DVD specification": "v94",
  "你所期望的永远 ～Latest Edition～": "v94",
  "幻燐的姬将军2：引导灵魂的族谱": "v507",
  从此方到彼方: "v551",
  魔女っ娘ア·ラ·モード: "v2501",
  "传颂之物 DVD-ROM版": "v3",
  "MapleColors 2 -メイプルカラーズセカンド-": "v1285",
  春色樱濑: "v859",
  星之歌: "v1002",
  "水平线尽头有多远 - Deep Blue Sky ＆ Pure White Wings -": "v972",
  单恋之月: "v1075",
  世界树与恋爱魔法使: "v689",
  "天之少女 PREMIUM EDITION": "v17012",
  "相逢在明月映照的彼岸 SweetSummerRainbow": "v26485",
  罪之光约会: "v17872",
  "在你的身边恋上你! -THE RESPECTIVE HAPPINESS-": "v17651",
  "在这苍穹展翅 CRUISE SIGN": "v9093",
  向日葵教会和漫长的暑假: "v10557",
  "闪耀十字军 -Passion Star Stream-": "v666",
  百机夜行: "v11164",
  "舞风的消散 -Where leads to feeling destination-": "v6678",
  "天冥的征服者 -魔族制压篇-": "v27691",
  "D.C.4 PLUS HARMONY": "v24351",
  "请认真和我恋爱！S": "v6245",
  "请认真和我恋爱！！": "v1143",
  "催眠性指导 Secret Lesson": "v41351",
  领地贵族: "v21466",
  你在米吉多之丘的呼唤: "v1165",
  // 年份校验会把同系列作品绑成同一行，这几条显式纠偏
  "Noble☆Works": "v4806",
  "神怒之日 ～Acta est Fabula～": "v548",
  "77～双星再会之时～": "v1547",
  // VNDB 只收了系列首作，续作没有独立条目
  "CRIMINAL BORDER 2nd offence": null,
  "CRIMINAL BORDER 3rd offence": null,
  // 简体写法与已解析的繁体行是同一部作品
  "真·恋姬†无双～乙女缭乱☆三国志演义～": "v1967",
  // VNDB 还没有条目
  AiComi: null,
};

/**
 * 中文 / 日文标题与 VNDB 的罗马音标题对不上是常态（`永远的艾塞莉娅` →
 * `Eien no Aselia`），光比标题会把大半命中判成失败。这里再加一道
 * 「发售年份」校验：大赏评的是当年发售的作品，搜索结果里发售年与颁奖年
 * 相差 ≤1 年就认。两者都不满足才继续往下试。
 */
function yearAcceptable(released: string | undefined, year: number): boolean {
  if (!released) return false;
  const releaseYear = Number(released.slice(0, 4));
  if (!Number.isFinite(releaseYear) || releaseYear <= 0) return false;
  return Math.abs(releaseYear - year) <= 1;
}

const cache = new Map<string, string | null>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchVn(key: string, year: number): Promise<string | null> {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: ["and", ["search", "=", key]],
      fields: "id,title,alttitle,released",
      sort: "searchrank",
      results: 10,
    }),
  });
  if (response.status === 429) {
    await sleep(5000);
    return searchVn(key, year);
  }
  if (!response.ok) return null;
  const body = (await response.json()) as {
    results?: { id: string; title: string; alttitle?: string | null; released?: string }[];
  };
  for (const item of body.results ?? []) {
    if (titlesMatch(key, item.title, item.alttitle ?? null)) return item.id;
    if (yearAcceptable(item.released, year)) return item.id;
  }
  return null;
}

async function resolveVnId(title: string, year: number): Promise<string | null> {
  const override = VN_OVERRIDES[title];
  if (override !== undefined) return override;
  const key = `${title}|${year}`;
  if (cache.has(key)) return cache.get(key)!;
  for (const variant of titleVariants(title)) {
    const variantKey = `${variant}|${year}`;
    if (cache.has(variantKey)) {
      const hit = cache.get(variantKey)!;
      if (hit) {
        cache.set(key, hit);
        return hit;
      }
      continue;
    }
    const vnId = await searchVn(variant, year);
    cache.set(variantKey, vnId);
    await sleep(1550);
    if (vnId) {
      cache.set(key, vnId);
      return vnId;
    }
  }
  cache.set(key, null);
  return null;
}

/** 读 JSON 数组，文件不存在 / 格式不对时当作空表 */
async function readArray(path: string): Promise<unknown[]> {
  try {
    const data = (await Bun.file(path).json()) as unknown;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** 旧输出文件里的 vnId：Getchu 优先按 (年 + 标题)、退回 (年,部门,名次)；萌系按归一化标题 */
async function loadPrevious(): Promise<{
  getchu: Map<string, string | null>;
  moe: Map<string, string | null>;
}> {
  const getchu = new Map<string, string | null>();
  const moe = new Map<string, string | null>();
  for (const entry of (await readArray(GETCHU_OUTPUT)) as GetchuEntry[]) {
    if (typeof entry?.year !== "number" || typeof entry?.rank !== "number") continue;
    getchu.set(`${entry.year}|${entry.dept}|${entry.rank}`, entry.vnId ?? null);
    const titleKey = `${entry.year}|title|${normalize(entry.title)}`;
    if (!getchu.has(titleKey)) getchu.set(titleKey, entry.vnId ?? null);
  }
  for (const entry of (await readArray(MOE_OUTPUT)) as MoeEntry[]) {
    if (typeof entry?.title !== "string") continue;
    moe.set(normalize(entry.title), entry.vnId ?? null);
  }
  return { getchu, moe };
}

async function loadCache(): Promise<void> {
  try {
    const data = (await Bun.file(CACHE_PATH).json()) as Record<string, string | null>;
    for (const [key, value] of Object.entries(data)) cache.set(key, value);
  } catch {
    /* 首次运行没有缓存 */
  }
}

async function saveCache(): Promise<void> {
  const data = Object.fromEntries([...cache.entries()].sort(([a], [b]) => a.localeCompare(b)));
  await Bun.write(CACHE_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

/* -------------------------------------------------------------------------- */
/* 主流程                                                                      */
/* -------------------------------------------------------------------------- */

/** 从 `角色：xxx；声优：yyy` 里取角色名 */
function characterOf(note: string): string {
  return note.match(/角色：([^；]+)/)?.[1]?.trim() ?? "";
}

async function main(): Promise<void> {
  const rows = await loadRows();
  const previous = await loadPrevious();
  await loadCache();

  const getchu: GetchuEntry[] = [];
  const moe: MoeEntry[] = [];
  const pending: { entry: MoeEntry | GetchuEntry; title: string }[] = [];

  for (const row of rows) {
    const title = row.title.trim();
    const year = Number(row.year);
    const company = row.company.trim();

    if (row.award === "萌系游戏大赏") {
      const prize = MOE_PRIZE[row.prize.trim()];
      if (!prize || !title) continue;
      const fixedYear = MOE_YEAR_FIX[year] ?? year;
      const override = VN_OVERRIDES[title];
      const entry: MoeEntry = {
        year: fixedYear,
        prize,
        title,
        brand: company,
        vnId: override !== undefined ? override : (previous.moe.get(normalize(title)) ?? null),
      };
      moe.push(entry);
      if (!entry.vnId) pending.push({ entry, title });
      continue;
    }

    const dept = DEPT_BY_LABEL.get(row.department.trim());
    if (!dept) continue; // 制作公司部门等非作品部门
    const rank = Number(row.prize.replace(/\D/g, ""));
    if (!title || !rank) continue;

    // 角色 / 配音部门：作品名做主标题，角色名放副标题
    const character = dept === "chara" || dept === "voice" ? characterOf(row.note) : "";
    const override = VN_OVERRIDES[title];
    const entry: GetchuEntry = {
      year,
      dept,
      rank,
      title,
      brand: character || company,
      vnId:
        override !== undefined
          ? override
          : (previous.getchu.get(`${year}|title|${normalize(title)}`) ??
            previous.getchu.get(`${year}|${dept}|${rank}`) ??
            null),
    };
    getchu.push(entry);
    if (!entry.vnId) pending.push({ entry, title });
  }

  console.log(
    `CSV ${rows.length} 行 → Getchu ${getchu.length} 条 / 萌系 ${moe.length} 条，待查 ${pending.length} 条`
  );

  // 萌娘百科 2009 作画部门把第 7 名也写成了「第6名」——同一 (年,部门) 名次必须唯一，
  // 撞号的按原顺序往后顺延一位
  const usedRanks = new Map<string, Set<number>>();
  let bumped = 0;
  for (const entry of getchu) {
    const group = `${entry.year}|${entry.dept}`;
    const used = usedRanks.get(group) ?? new Set<number>();
    usedRanks.set(group, used);
    while (used.has(entry.rank)) {
      entry.rank++;
      bumped++;
    }
    used.add(entry.rank);
  }
  if (bumped > 0) console.log(`  名次重复纠偏 ${bumped} 条`);

  // 同一作品会横跨多个部门（総合 / シナリオ / ムービー…），先按标题把已知
  // vnId 铺一遍，能省掉大量重复查询
  const byTitle = new Map<string, string>();
  for (const entry of [...moe, ...getchu]) {
    if (!entry.vnId) continue;
    for (const key of [entry.title, normalize(entry.title)]) {
      if (!byTitle.has(key)) byTitle.set(key, entry.vnId);
    }
  }
  let shared = 0;
  for (const entry of [...moe, ...getchu]) {
    if (entry.vnId) continue;
    const hit = byTitle.get(entry.title) ?? byTitle.get(normalize(entry.title));
    if (hit) {
      entry.vnId = hit;
      shared++;
    }
  }
  const queue = pending.filter((item) => !item.entry.vnId);
  console.log(`  跨部门共享补到 ${shared} 条，仍需联网 ${queue.length} 条`);

  // 调试用：只解析前 N 条（`AWARDS_LIMIT=5 bun run sync:awards-csv`）
  const limit = Number(process.env.AWARDS_LIMIT ?? 0);
  const runQueue = limit > 0 ? queue.slice(0, limit) : queue;

  let done = 0;
  for (const item of runQueue) {
    item.entry.vnId = await resolveVnId(item.title, item.entry.year);
    done++;
    if (done % 25 === 0) {
      console.log(`  已解析 ${done}/${runQueue.length}（缓存累计 ${cache.size} 键）`);
      await saveCache();
    }
  }
  await saveCache();

  // 同一年度内，萌系可能出现同奖项并列；保持 CSV 原顺序的稳定排序
  moe.sort((a, b) => b.year - a.year || MOE_PRIZE_ORDER[a.prize] - MOE_PRIZE_ORDER[b.prize]);
  getchu.sort(
    (a, b) =>
      b.year - a.year ||
      (DEPT_ORDER.get(a.dept) ?? 0) - (DEPT_ORDER.get(b.dept) ?? 0) ||
      a.rank - b.rank
  );

  await Bun.write(MOE_OUTPUT, `${JSON.stringify(moe, null, 2)}\n`);
  await Bun.write(GETCHU_OUTPUT, `${JSON.stringify(getchu, null, 2)}\n`);

  const missing = [...moe, ...getchu].filter((entry) => !entry.vnId).length;
  console.log(
    `写入 ${getchu.length} 条 → ${GETCHU_OUTPUT} / ${moe.length} 条 → ${MOE_OUTPUT}` +
      `（未匹配 vnId ${missing} 条）`
  );
}

await main();
