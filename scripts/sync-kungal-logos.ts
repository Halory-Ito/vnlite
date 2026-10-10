/**
 * 同步鲲 Galgame 论坛的「Galgame 会社」资料库 → 本地 LOGO 索引。
 *
 *   bun run scripts/sync-kungal-logos.ts            # 全量（列表 + 详情）
 *   bun run scripts/sync-kungal-logos.ts --limit 200 # 试跑前 N 家公司
 *
 * ## 为什么要有静态索引
 *
 * VNDB 没有厂商 LOGO；鲲 Galgame 论坛的会社库有 4000+ 家公司与 LOGO，但它的
 * **搜索接口需要登录**（`/api/...` 也在 robots 的 Disallow 里），公开可抓的只有
 * 分页列表页与详情页。所以策略是：**构建期把公开页面抓成一份小索引随包发布**，
 * 运行时只做本地查表（零网络请求、零反爬风险）。索引过期了重跑本脚本即可。
 *
 * ## 抓什么
 *
 * 1. 列表页 `?page=N`（每页 100 家）：公司名 + LOGO 文件名
 * 2. 详情页 `/galgame/official/{id}`：官网域名（`官方网站` 链接）
 *
 * 输出 `src/features/catalog/kungal-logos.json`：
 *   - `domains`：官网域名 → LOGO 文件名（**首选**，和 VNDB 的官网外链精确对应）
 *   - `names`：归一化公司名 → LOGO 文件名（域名缺失时的兜底）
 *
 * LOGO 文件名是 64 位 hex，图片 URL 由它拼出（见 `kungal-logo.ts`），
 * 只存文件名能省掉每条约 60 字节的重复前缀。
 */

import { normalizeCompanyName } from "../src/features/catalog/kungal-logo";

const BASE = "https://www.kungal.com/galgame/official";
const OUT_PATH = "src/features/catalog/kungal-logos.json";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) || 0 : 0;
const detailArg = args.indexOf("--concurrency");
const CONCURRENCY = detailArg >= 0 ? Math.max(1, Number(args[detailArg + 1]) || 5) : 5;

interface Company {
  id: string;
  name: string;
  /** LOGO 文件名（64 位 hex，不含扩展名）；没有 LOGO 时为 null */
  logo: string | null;
}

/** 极简 HTML 实体解码 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  // 单页超时 20s：默认 fetch 没有超时，网站变慢时会把整个同步挂死
  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

/** 列表页 → 公司条目。按卡片分块解析（`href` → `alt`「<名> logo」→ `src`） */
function parseListPage(html: string): Company[] {
  const companies: Company[] = [];
  const chunks = html.split(/href="\/galgame\/official\//).slice(1);
  for (const chunk of chunks) {
    const id = /^(\d+)"/.exec(chunk)?.[1];
    if (!id) continue;
    const alt = decodeEntities(/alt="([^"]*?) logo"/.exec(chunk)?.[1] ?? "").trim();
    const src = /src="(https:\/\/image\.kungal\.iloveren\.link\/[^"]+)"/.exec(chunk)?.[1] ?? null;
    const logo = src ? (/[0-9a-f]{64}/i.exec(src)?.[0]?.toLowerCase() ?? null) : null;
    // 没有 alt 的卡片（无 LOGO）从 `<h3>` 里取名字（去掉「+ N」徽标）
    const heading = alt || decodeEntities(/<h3[^>]*>([^<]{1,80})/.exec(chunk)?.[1] ?? "").trim();
    const name = heading.replace(/\s*\+\s*\d+$/, "").trim();
    if (name) companies.push({ id, name, logo });
  }
  return companies;
}

/** 详情页 → 官网域名列表（「官方网站」链接的 host） */
function parseOfficialDomains(html: string): string[] {
  const domains = new Set<string>();
  // 锚点里夹着 Nuxt 注释节点与 svg 图标，所以「文本 → </a>」要允许长距离匹配，
  // 匹配后再剥标签取纯文本
  const anchor = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const text = match[2]!
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!/官方网站|official website/i.test(text)) continue;
    try {
      const host = new URL(match[1]!).hostname.replace(/^www\./i, "").toLowerCase();
      if (host) domains.add(host);
    } catch {
      // 忽略非法 URL
    }
  }
  return [...domains];
}

async function crawlListPages(): Promise<Company[]> {
  const all: Company[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page += 1) {
    const html = await fetchText(`${BASE}?page=${page}`);
    const companies = parseListPage(html).filter((c) => !seen.has(c.id));
    for (const company of companies) seen.add(company.id);
    all.push(...companies);
    process.stdout.write(`\r列表页 ${page}：累计 ${all.length} 家`);
    if (companies.length === 0) break;
    if (LIMIT > 0 && all.length >= LIMIT) break;
    await sleep(120);
  }
  process.stdout.write("\n");
  return all;
}

/** 抓详情页补官网域名（带并发与失败重试一次） */
async function crawlDomains(companies: Company[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  let done = 0;
  let failed = 0;
  const queue = [...companies];

  async function worker(): Promise<void> {
    for (;;) {
      const company = queue.shift();
      if (!company) return;
      try {
        let html: string;
        try {
          html = await fetchText(`${BASE}/${company.id}`);
        } catch {
          await sleep(1500);
          html = await fetchText(`${BASE}/${company.id}`);
        }
        map.set(company.id, parseOfficialDomains(html));
      } catch {
        failed += 1;
      }
      done += 1;
      // 每 100 条打一行（不换行的 \r 进度被重定向到文件时不刷新，看不到）
      if (done % 100 === 0 || done === companies.length) {
        console.log(`详情页 ${done}/${companies.length}（失败 ${failed}）`);
      }
      await sleep(60);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  process.stdout.write("\n");
  return map;
}

async function main(): Promise<void> {
  console.log("抓取鲲 Galgame 会社列表…");
  const companies = await crawlListPages();
  const withLogo = companies.filter((c) => c.logo);
  console.log(
    `共 ${companies.length} 家（${withLogo.length} 家有 LOGO，${companies.length - withLogo.length} 家无）`
  );

  console.log("抓取详情页取官网域名…");
  const domainsById = await crawlDomains(companies);

  const domains: Record<string, string> = {};
  const names: Record<string, string> = {};
  let domainHits = 0;
  for (const company of companies) {
    if (!company.logo) continue;
    for (const domain of domainsById.get(company.id) ?? []) {
      // 同一域名多家公司时保留先到者（列表顺序按重要度，通常是最主要那家）
      if (!(domain in domains)) {
        domains[domain] = company.logo;
        domainHits += 1;
      }
    }
    const key = normalizeCompanyName(company.name);
    // 归一化后撞名（同名不同公司）就丢弃，避免张冠李戴
    if (!key) continue;
    if (key in names && names[key] !== company.logo) delete names[key];
    else if (!(key in names)) names[key] = company.logo;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: BASE,
    /** 官网域名 → LOGO 文件名（首选匹配） */
    domains,
    /** 归一化公司名 → LOGO 文件名（域名缺失时兜底） */
    names,
  };
  await Bun.write(OUT_PATH, `${JSON.stringify(payload)}\n`);
  console.log(
    `写出 ${OUT_PATH}：域名 ${Object.keys(domains).length}（含 ${domainHits} 条命中公司）、名称 ${Object.keys(names).length}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
