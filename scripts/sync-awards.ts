/**
 * 生成 `src/features/awards/lib/awards.json` —— 萌えゲーアワード（萌系大赏）主线数据。
 *
 * ## 数据两段取材
 *
 * - **2006–2020（前期）**：官网各年代版式差异大（2006-2008 是「美少女ゲームアワード」
 *   单一大赏、2009-2012 金賞/銀賞/銅賞、2013-2020 大賞+準大賞），主线层级取自
 *   日文维基「萌えゲーアワード」条目整理的获奖表 —— 已抽样对照官网
 *   2011 / 2013 / 2018 页面一致，硬编码在下方的 `HISTORY` 里。
 *   官网每次改版式就补一套解析不划算，静态历史数据以表格为准，逐年往后加。
 * - **2021 起（现行）**：官网 `prize/{年}/gp.html` 单一大赏页，版式稳定
 *   （`<h3 class="title">` 内两个 `<p>`），继续抓官网。
 *
 * 只收"主线"层级（大賞 / 準大賞 / 金 / 銀 / 銅）；2021 起各部門賞是几十个
 * 杂赏单页，噪声太大，不收。
 *
 * ## VNDB 对接
 *
 * 标题用 Kana 的 `search` 查作品 id（`resolveVn`）。输出文件里已有的行
 * （年份 + 层级 + 归一化标题 对上）不再发请求 —— 重跑只需解析新增行。
 *
 * 每年颁奖后手动跑一次：
 *
 * ```bash
 * bun run sync:awards
 * ```
 */

const OUTPUT = "src/features/awards/lib/awards.json";
const AWARD_BASE = "https://moe-gameaward.com/prize";
const API = "https://api.vndb.org/kana/vn";

/** 可选代理（如 `http://127.0.0.1:7890`）：官网直连不稳 / 被墙的机器设它 */
const PROXY = process.env.SYNC_PROXY ?? "";

interface AwardEntry {
  /** 颁奖年度 */
  year: number;
  /** 主线层级：大賞 / 準大賞 / 金 / 銀 / 銅 */
  prize: "grand" | "semi" | "gold" | "silver" | "bronze";
  /** 作品名（日文原名） */
  title: string;
  /** 品牌 / 厂商 */
  brand: string;
  /** VNDB 作品 id；匹配不到是 null */
  vnId: string | null;
}

type Prize = AwardEntry["prize"];

/** 层级在输出里的排序（大賞最先，銅賞垫底） */
const PRIZE_ORDER: Record<Prize, number> = { grand: 0, semi: 1, gold: 2, silver: 3, bronze: 4 };

/**
 * 个别行的标题与 VNDB 结构性对不上（维基多写了版本字母、官网有副标题差异），
 * `resolveVn` 的变体兜底修不过来，显式写映射。键是 HISTORY / 页面里的原标题。
 */
const VN_OVERRIDES: Readonly<Record<string, string>> = {
  // 维基写「戦国†恋姫X」，VNDB 收的是无 X 的初代；X 版是后续 FHD 重发行
  "戦国†恋姫X 〜乙女絢爛☆戦国絵巻〜": "v13188",
};

/** 从这一年起走官网解析（更早的进 HISTORY 表） */
const SCRAPE_FROM = 2021;

/**
 * 2006–2020 的主线获奖表（来源：日文维基「萌えゲーアワード」获奖表，
 * 抽样对照官网 gp.html 一致）。名称尽量贴近 VNDB 的常用写法，标题不匹配时
 * `titleVariants` 会做一定的变体兜底。
 */
const HISTORY: readonly (readonly [number, Prize, string, string])[] = [
  [2006, "grand", "この青空に約束を―", "戯画"],
  [2007, "grand", "遥かに仰ぎ、麗しの", "PULLTOP"],
  [2008, "grand", "G線上の魔王", "あかべぇそふとつぅ"],
  // 2009–2012 是金銀銅（两银根据年份可能为 2 作品）
  [2009, "gold", "真・恋姫†無双 〜乙女繚乱☆三国志演義〜", "BaseSon"],
  [2009, "silver", "真剣で私に恋しなさい！", "みなとそふと"],
  [2009, "bronze", "ティンクル☆くるせいだーす", "Lillian"],
  [2010, "gold", "黄昏のシンセミア", "あっぷりけ"],
  [2010, "silver", "戦女神VERITA", "エウシュリー"],
  [2010, "bronze", "素晴らしき日々 〜不連続存在〜", "ケロQ"],
  [2011, "gold", "グリザイアの果実", "フロントウイング"],
  [2011, "silver", "神採りアルケミーマイスター", "エウシュリー"],
  [2011, "silver", "カミカゼ☆エクスプローラー！", "クロシェット"],
  [2012, "gold", "この大空に、翼をひろげて", "PULLTOP"],
  [2012, "silver", "グリザイアの迷宮", "フロントウイング"],
  [2012, "silver", "真剣で私に恋しなさい！S", "みなとそふと"],
  // 2013–2020 是大賞 + 準大賞
  [2013, "grand", "月に寄りそう乙女の作法", "Navel"],
  [2013, "semi", "グリザイアの楽園", "フロントウイング"],
  [2013, "semi", "プリズム◇リコレクション！", "クロシェット"],
  [2014, "grand", "蒼の彼方のフォーリズム", "sprite"],
  [2014, "semi", "あの晴れわたる空より高く", "チュアブルソフト"],
  [2014, "semi", "なないろリンカネーション", "シルキーズプラス"],
  [2015, "grand", "サクラノ詩 -櫻の森の上を舞う-", "枕"],
  [2015, "semi", "見上げてごらん、夜空の星を", "PULLTOP"],
  [2015, "semi", "花咲ワークスプリング！", "SAGA PLANETS"],
  [2016, "grand", "ワガママハイスペック", "まどそふと"],
  [2016, "semi", "まいてつ", "Lose"],
  [2016, "semi", "戦国†恋姫X 〜乙女絢爛☆戦国絵巻〜", "BaseSon"],
  [2016, "semi", "千恋*万花", "ゆずソフト"],
  [2017, "grand", "ノラと皇女と野良猫ハート2", "HARUKAZE"],
  [2017, "semi", "金色ラブリッチェ", "SAGA PLANETS"],
  [2017, "semi", "景の海のアペイリア", "シルキーズプラス"],
  [2017, "semi", "Making*Lovers", "SMEE"],
  [2018, "grand", "Summer Pockets", "Key"],
  [2018, "semi", "Rance X -決戦-", "アリスソフト"],
  [2018, "semi", "真・恋姫†夢想-革命- 孫呉の血脈", "BaseSon"],
  [2018, "semi", "ラズベリーキューブ", "まどそふと"],
  [2019, "grand", "抜きゲーみたいな島に住んでる貧乳はどうすりゃいいですか?2", "Qruppo"],
  [2019, "semi", "タマユラミライ", "Azurite"],
  [2019, "semi", "D.C.4 〜ダ・カーポ4〜", "CIRCUS"],
  [2019, "semi", "きまぐれテンプテーション", "シルキーズプラス"],
  [2020, "grand", "まいてつ Last Run!!", "Lose"],
  [2020, "semi", "ハミダシクリエイティブ", "まどそふと"],
  [2020, "semi", "かけぬけ★青春スパーキング！", "SAGA PLANETS"],
  [2020, "semi", "ドーナドーナ いっしょにわるいことをしよう", "アリスソフト"],
];

/* -------------------------------------------------------------------------- */
/* 官网 2021+ 解析（沿用旧版式的 modern 分支）                                  */
/* -------------------------------------------------------------------------- */

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** 官网抓取：先直连，失败且有代理再走一次 */
async function fetchMoe(path: string): Promise<string | null> {
  const url = `${AWARD_BASE}/${path}`;
  try {
    const direct = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (direct.ok) return await direct.text();
    console.warn(`  ${path}: HTTP ${direct.status}`);
  } catch (error) {
    console.warn(`  ${path}: 直连失败 ${String(error)}`);
  }
  if (!PROXY) return null;
  try {
    const relay = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      proxy: PROXY,
    });
    if (relay.ok) return await relay.text();
    console.warn(`  ${path}: 代理 HTTP ${relay.status}`);
  } catch (error) {
    console.warn(`  ${path}: 代理失败 ${String(error)}`);
  }
  return null;
}

/** 2021+ 单一大赏页：`<h3 class="title"><p>标题</p><p class="btn_white_prize">品牌</p></h3>` */
function parseGrandPrize(html: string): { title: string; brand: string } | null {
  const modern = html.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
  if (!modern) return null;
  const block = modern[1] ?? "";
  const title = stripTags(block.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "");
  const brand = stripTags(block.match(/<p class="btn_white_prize">([\s\S]*?)<\/p>/)?.[1] ?? "");
  return title ? { title, brand } : null;
}

/* -------------------------------------------------------------------------- */
/* VNDB 标题匹配                                                               */
/* -------------------------------------------------------------------------- */

/** 归一化：小写 + 去掉所有标点 / 符号 / 空白（全角破折号、？、・ 都要处理） */
function normalize(text: string): string {
  return text
    .replace(/[〜～]/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

/** 两种波浪号互转：官网/维基常用 〜 (U+301C)，VNDB 常见 ～ (U+FF5E)，反之亦然 */
function swapWave(text: string): string {
  return text.replace(/[〜～]/g, (w) => (w === "〜" ? "～" : "〜"));
}

/**
 * 标题的几种写法：原样 / 波浪号互换 / 去掉括号补语 / 去掉最后一个词。
 * 官网标题与 VNDB 的写法差异（品牌后缀、括号副标题、全半角波浪线）都在这一步绕掉。
 */
function titleVariants(title: string): string[] {
  const variants = [title, swapWave(title)];
  const withoutParens = title.replace(/[（(][^）)]*[）)]/g, "").trim();
  if (withoutParens && withoutParens !== title) variants.push(withoutParens);
  const withoutLastWord = title.replace(/\s+\S+$/, "").trim();
  if (withoutLastWord && withoutLastWord !== title) variants.push(withoutLastWord);
  return [...new Set(variants.filter(Boolean))];
}

/** 标题匹配：归一化后互相包含即算命中（太短的串不参与「被包含」，免得随缘命中） */
function titlesMatch(awardTitle: string, vnTitle: string, alttitle: string | null): boolean {
  const wanted = normalize(awardTitle);
  for (const candidate of [vnTitle, alttitle ?? ""]) {
    const normalized = normalize(candidate);
    if (!normalized) continue;
    if (normalized === wanted) return true;
    if (wanted.includes(normalized) && normalized.length >= 4) return true;
    if (normalized.includes(wanted) && wanted.length >= 4) return true;
  }
  return false;
}

/** 用 Kana 的 search 查 VN id（search 必须包 in and，Kana 的坑见 smoke:api） */
async function resolveVn(awardTitle: string): Promise<{ id: string; title: string } | null> {
  for (const variant of titleVariants(awardTitle)) {
    const response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: ["and", ["search", "=", variant]],
        fields: "id,title,alttitle",
        sort: "searchrank",
        results: 5,
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        results?: { id: string; title: string; alttitle?: string | null }[];
      };
      for (const item of body.results ?? []) {
        if (titlesMatch(variant, item.title, item.alttitle ?? null)) {
          return { id: item.id, title: variant };
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* 主流程                                                                      */
/* -------------------------------------------------------------------------- */

/** 已有输出的 (年, 层级, 归一化标题) → vnId / 已展示标题，重跑免请求 */
async function loadKnown(): Promise<Map<string, AwardEntry>> {
  const map = new Map<string, AwardEntry>();
  const previous = await Bun.file(OUTPUT)
    .json()
    .catch(() => null);
  if (!Array.isArray(previous)) return map;
  for (const entry of previous as AwardEntry[]) {
    if (typeof entry?.year !== "number" || typeof entry?.title !== "string") continue;
    map.set(`${entry.year}|${entry.prize ?? "grand"}|${normalize(entry.title)}`, entry);
  }
  return map;
}

async function main(): Promise<void> {
  const known = await loadKnown();
  const entries: AwardEntry[] = [];
  const currentYear = new Date().getFullYear();

  // 前期：HISTORY 表
  for (const [year, prize, title, brand] of HISTORY) {
    const overrideId = VN_OVERRIDES[title];
    const hit = known.get(`${year}|${prize}|${normalize(title)}`);
    if (hit?.vnId) {
      entries.push({ year, prize, title: hit.title, brand, vnId: hit.vnId });
      console.log(`  ${year} ${prize}: ${title} / ${brand} → ${hit.vnId}（已有）`);
      continue;
    }
    if (overrideId) {
      entries.push({ year, prize, title, brand, vnId: overrideId });
      console.log(`  ${year} ${prize}: ${title} / ${brand} → ${overrideId}（override）`);
      continue;
    }
    const vn = await resolveVn(title);
    console.log(`  ${year} ${prize}: ${title} / ${brand} → ${vn?.id ?? "（未匹配）"}`);
    entries.push({ year, prize, title: vn?.title ?? title, brand, vnId: vn?.id ?? null });
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  // 现行：官网单一大赏页 —— 已有缓存的年份直接复用，抓不到也不丢行
  for (let year = Math.min(SCRAPE_FROM, currentYear); year <= currentYear; year++) {
    const cached = [...known.values()].find((e) => e.year === year && e.prize === "grand");
    let prize: { title: string; brand: string } | null = null;
    const html = await fetchMoe(`${year}/gp.html`);
    if (html) prize = parseGrandPrize(html);
    if (!prize) {
      if (cached) {
        const row: AwardEntry = {
          year,
          prize: "grand",
          title: cached.title,
          brand: cached.brand,
          vnId: cached.vnId,
        };
        entries.push(row);
        console.log(
          `  ${year} grand: ${cached.title} → ${cached.vnId ?? "未匹配"}（用缓存，官网没抓到）`
        );
      } else {
        console.warn(`  ${year}: 官网没抓到，缓存里也没有`);
      }
      continue;
    }
    const knownTitle =
      cached && normalize(cached.title) === normalize(prize.title) ? cached : undefined;
    const vn = knownTitle?.vnId
      ? { id: knownTitle.vnId, title: knownTitle.title }
      : await resolveVn(prize.title);
    console.log(
      `  ${year} grand: ${prize.title} / ${prize.brand} → ${vn?.id ?? "（未匹配）"}${knownTitle ? "（已有）" : ""}`
    );
    entries.push({
      year,
      prize: "grand",
      title: vn?.title ?? prize.title,
      brand: prize.brand || cached?.brand || "",
      vnId: vn?.id ?? cached?.vnId ?? null,
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  if (entries.length === 0) {
    console.error("一条都没凑齐，放弃写入");
    process.exit(1);
  }

  // 排序：年份降序，年内层级按 大賞→準大賞→金→銀→銅
  entries.sort((a, b) => b.year - a.year || PRIZE_ORDER[a.prize] - PRIZE_ORDER[b.prize]);
  await Bun.write(OUTPUT, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`写入 ${entries.length} 条 → ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
