/**
 * GitHub 加速代理（镜像）列表 + 延迟测速。
 *
 * ## 用法
 *
 * 代理都是「前缀式」：把目标 URL 直接拼在代理地址后面即可，例如
 *   `https://ghfast.top/` + `https://github.com/…/app.apk`
 *
 * ## 怎么挑
 *
 * **测速**：对每个代理发一次 `HEAD` 请求（不下载正文，省流量），
 * 记下往返耗时，取**最小**的那个去下载。
 * `HEAD` 顺带验证了代理确实能拿到这个文件（拿不到会 4xx/5xx），
 * 比「先下载再发现是错误页」强。
 *
 * 六个代理**并行**测，谁快用谁；单个代理超时就当它不可用。
 *
 * ⚠️ 代理是**第三方服务**，随时可能挂 —— 列表里多放几个，
 * 全部失败时调用方要能回退到直连。
 */

export interface GithubMirror {
  id: string;
  /** 展示名（调试用，不上界面） */
  name: string;
  /** 代理前缀，拼在目标 URL 前面 */
  prefix: string;
}

/** 候选加速代理（2026-10 实测可用；失效的会自动被测速淘汰） */
export const GITHUB_MIRRORS: GithubMirror[] = [
  { id: "ghfast-top", name: "ghfast.top", prefix: "https://ghfast.top/" },
  { id: "gh-proxy-com", name: "gh-proxy.com", prefix: "https://gh-proxy.com/" },
  { id: "ghproxy-net", name: "ghproxy.net", prefix: "https://ghproxy.net/" },
  { id: "hk-gh-proxy-com", name: "hk.gh-proxy.com", prefix: "https://hk.gh-proxy.com/" },
  { id: "gh-proxy-cc", name: "gh-proxy.cc", prefix: "https://gh-proxy.cc/" },
  { id: "ghproxy-imciel", name: "imciel", prefix: "https://ghproxy.imciel.com/" },
];

/** 单个代理的测速超时 */
const PROBE_TIMEOUT_MS = 5000;

/** 拼出代理后的下载链接 */
export function mirrorUrl(mirror: GithubMirror, target: string): string {
  return `${mirror.prefix}${target}`;
}

/**
 * 测一个地址的往返延迟（毫秒）。
 *
 * 走 `HEAD`：只取响应头，不拉正文。失败 / 超时返回 null（该地址不可用）。
 */
export async function measureLatency(
  url: string,
  timeoutMs: number = PROBE_TIMEOUT_MS
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!response.ok) return null;
    return Date.now() - startedAt;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface MirrorProbe {
  mirror: GithubMirror;
  /** 往返毫秒；null = 不可用 */
  latency: number | null;
}

/** 并行测速全部候选，返回每个代理的结果（顺序与入参一致） */
export async function probeMirrors(
  target: string,
  mirrors: GithubMirror[] = GITHUB_MIRRORS
): Promise<MirrorProbe[]> {
  return Promise.all(
    mirrors.map(async (mirror) => ({
      mirror,
      latency: await measureLatency(mirrorUrl(mirror, target)),
    }))
  );
}

/**
 * 按延迟从低到高排（不可用的排最后）。
 *
 * 排序后第一个就是「延迟最低的可用代理」。
 */
export function sortByLatency(probes: MirrorProbe[]): MirrorProbe[] {
  return [...probes].sort(
    (a, b) => (a.latency ?? Number.POSITIVE_INFINITY) - (b.latency ?? Number.POSITIVE_INFINITY)
  );
}

/**
 * 选出延迟最低的可用代理；全不可用返回 null。
 *
 * 延迟相同按入参顺序取靠前的（`GITHUB_MIRRORS` 的顺序是按口碑排的）。
 */
export function pickFastestMirror(probes: MirrorProbe[]): MirrorProbe | null {
  const sorted = sortByLatency(probes);
  const best = sorted[0];
  return best && best.latency !== null ? best : null;
}
