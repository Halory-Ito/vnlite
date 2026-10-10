/**
 * 厂商 LOGO：鲲 Galgame 会社库的本地查表。
 *
 * VNDB 没有厂商 LOGO。数据来自 https://www.kungal.com/galgame/official
 * （鲲 Galgame 论坛的会社资料库，4000+ 家公司）—— 它的搜索接口要登录、
 * `/api` 也在 robots 的 Disallow 里，所以采用**构建期抓好的静态索引**
 * （`kungal-logos.json`，生成脚本 `scripts/sync-kungal-logos.ts`），
 * 运行时零请求、只做本地查表。
 *
 * 匹配顺序：
 *   1. **官网域名**：VNDB 外链里的官网 host 与索引 `domains` 精确对应（首选）
 *   2. **公司名**：归一化后的 VNDB `name` / `original` 命中索引 `names`（兜底）
 * 都不中 → null（调用方不画图）。
 */

import type { Producer } from "@/lib/api/types";

export interface KungalLogoIndex {
  generatedAt: string;
  source: string;
  /** 官网域名 → LOGO 文件名（64 位 hex） */
  domains: Record<string, string>;
  /** 归一化公司名 → LOGO 文件名 */
  names: Record<string, string>;
}

let indexPromise: Promise<KungalLogoIndex> | null = null;

/**
 * 懒加载索引：第一次真的解析厂商 LOGO 时才解析这份 JSON。
 * 全应用共用同一份 Promise（React Query / 手写 hook 都从这里取）。
 */
export function getKungalLogoIndex(): Promise<KungalLogoIndex> {
  indexPromise ??= import("./kungal-logos.json").then(
    (module) => module.default as KungalLogoIndex
  );
  return indexPromise;
}

/**
 * 归一化公司名。
 *
 * ⚠️ 构建脚本与运行时共用这一个实现 —— 两边规则不一致的话索引就永远对不上。
 */
export function normalizeCompanyName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(株式会社|有限会社|合同会社)/g, "")
    .replace(/[\s·・.,!?'"“”‘’()（）[\]【】<>《》/\\|_\-–—:+&×]/g, "")
    .replace(/(incorporated|corporation|limited|corp|ltd|llc|inc)$/, "");
}

/** 索引里的 64 位 hex 文件名 → 鲲 Galgame 图床 URL */
export function kungalLogoUrl(hash: string): string {
  return `https://image.kungal.iloveren.link/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.webp`;
}

/** 取厂商官网 URL：优先 label 为「Official website」的外链，否则第一个 http(s) 外链 */
export function officialWebsiteOf(producer: Producer): string | null {
  const links = producer.extlinks ?? [];
  const official = links.find((link) => /official website/i.test(link.label));
  const chosen = official ?? links.find((link) => /^https?:\/\//i.test(link.url));
  return chosen?.url ?? null;
}

/**
 * 从 URL 取归一化域名（去协议 / 用户信息 / 端口 / `www.`，转小写）。
 *
 * 不依赖 `URL`（RN/Hermes 的实现不完整），用正则解析。非法返回 null。
 */
export function domainOf(url: string | null | undefined): string | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url ?? "");
  if (!match) return null;
  const host = match[1]!
    .split("@")
    .pop()!
    .split(":")[0]!
    .replace(/^www\./i, "")
    .toLowerCase();
  return host.length > 0 ? host : null;
}

/**
 * 按名称查表（纯函数）：归一化后的若干候选名 → LOGO URL。
 *
 * 历史 / 收藏里只存了名称（没有 extlinks），用它在渲染时兜底补 LOGO。
 */
export function lookupKungalLogoByName(
  index: KungalLogoIndex,
  candidates: readonly (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    const key = normalizeCompanyName(candidate);
    if (!key) continue;
    const hash = index.names[key];
    if (hash) return kungalLogoUrl(hash);
  }
  return null;
}

/**
 * 查表（纯函数，冒烟直接测）：索引 + 厂商信息 → LOGO URL。
 *
 * 先域名后名称；名称同时试 VNDB 的 `name` 与 `original`（原名常是日文，
 * 正好对应鲲 Galgame 的会社名）。
 */
export function lookupKungalLogo(
  index: KungalLogoIndex,
  producer: Pick<Producer, "name" | "original" | "extlinks">
): string | null {
  const domain = domainOf(officialWebsiteOf(producer as Producer));
  const byDomain = domain ? index.domains[domain] : undefined;
  if (byDomain) return kungalLogoUrl(byDomain);
  return lookupKungalLogoByName(index, [producer.name, producer.original]);
}

/** 解析一个厂商的 LOGO URL；拿不到返回 null（不抛错） */
export async function resolveKungalLogo(producer: Producer): Promise<string | null> {
  const index = await getKungalLogoIndex();
  return lookupKungalLogo(index, producer);
}

/** 只按名称解析（历史 / 收藏的兜底路径，没有厂商对象时用） */
export async function resolveKungalLogoByName(
  ...candidates: (string | null | undefined)[]
): Promise<string | null> {
  const index = await getKungalLogoIndex();
  return lookupKungalLogoByName(index, candidates);
}
