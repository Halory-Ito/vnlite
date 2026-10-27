/**
 * IP 归属地判定 —— 决定下载安装包时**要不要走 GitHub 加速代理**。
 *
 * ## 为什么需要
 *
 * GitHub Release 的附件在国内直连经常「连接重置 / 十几秒才起」，
 * 而加速代理（ghfast.top 之类）基本是毫秒级。判出国内就必须走代理。
 *
 * ## 怎么判
 *
 * 拿出口 IP 查归属地，返回两位国家/地区代码：
 *   - `CN` → 国内（**一律**用加速代理）
 *   - 其它 → 海外（直连 GitHub）
 *   - 查不到 → 未知（按海外处理，但下载失败时会回退到代理）
 *
 * 三个源依次降级（ip.sb → ipinfo.io → ipapi.co）：
 * ipapi.co 对无 UA 的请求会 403，所以放在最后当兜底。
 *
 * 结果**只缓存在内存**（不进磁盘）：手机随时可能换网络（Wi-Fi ↔ 4G），
 * 落盘的归属地很快就是错的，反而会误判。
 */

export type UpdateRegion = "cn" | "overseas" | "unknown";

/** 视为「国内」的国家/地区代码（要加只需改这里） */
const DOMESTIC_CODES = new Set(["CN"]);

/** 单个归属地查询源 */
interface RegionSource {
  url: string;
  /** 从响应里取国家/地区代码；取不到返回 null */
  pick: (data: unknown) => string | null;
}

const SOURCES: RegionSource[] = [
  { url: "https://api.ip.sb/geoip", pick: (d) => readString(d, "country_code") },
  { url: "https://ipinfo.io/json", pick: (d) => readString(d, "country") },
  { url: "https://ipapi.co/json/", pick: (d) => readString(d, "country_code") },
];

/** 单源超时（归属地查不出来不该拖住整个更新流程） */
const TIMEOUT_MS = 5000;

function readString(data: unknown, key: string): string | null {
  if (typeof data !== "object" || data === null) return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** 国家/地区代码 → 归属地判定（纯函数，冒烟直接测） */
export function regionFromCountryCode(code: string | null | undefined): UpdateRegion {
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized.length !== 2) return "unknown";
  return DOMESTIC_CODES.has(normalized) ? "cn" : "overseas";
}

/** 本次进程内的判定结果；判定不出来不缓存（下次重试） */
let cached: UpdateRegion | null = null;

async function querySource(source: RegionSource): Promise<UpdateRegion | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(source.url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    const region = regionFromCountryCode(source.pick(data));
    return region === "unknown" ? null : region;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 判定当前出口 IP 的归属地。
 *
 * 三个源全失败时返回 `"unknown"`（**不抛错**）—— 判不出来只是少了点优化，
 * 不该让「检查更新」整个失败。
 */
export async function detectRegion(signal?: AbortSignal): Promise<UpdateRegion> {
  if (cached) return cached;
  for (const source of SOURCES) {
    if (signal?.aborted) break;
    const region = await querySource(source);
    if (region) {
      cached = region;
      return region;
    }
  }
  return "unknown";
}

/** 清掉缓存（测试用；正常流程不需要） */
export function resetRegionCache(): void {
  cached = null;
}
