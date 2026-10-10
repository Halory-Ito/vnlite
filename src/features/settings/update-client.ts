/**
 * 「检查更新」的数据源。
 *
 * 依次尝试三个源，任何一个成功即返回：
 *   1. GitHub 最新 Release（有发布说明与发布页）
 *   2. GitHub Tags（只打了 tag、没发 Release 的仓库）
 *   3. jsDelivr 上的 `package.json`（GitHub 直连不稳时的国内可用镜像）
 *
 * ⚠️ 不发 User-Agent 头：RN 的 fetch 禁止自定义该头，OkHttp 会带默认 UA，
 * GitHub API 接受。
 */

import { DEVELOPER_INFO } from "@/constants/config";

export interface UpdateInfo {
  /** 版本号（可能带 `v` 前缀，交给 `isNewerVersion` 归一化） */
  version: string;
  /** 发布页 / 下载页 */
  url: string;
  /** 发布说明（Markdown，可能为 null） */
  notes: string | null;
}

const API = `https://api.github.com/repos/${DEVELOPER_INFO.repo}`;
const JSDELIVR_PKG = `https://cdn.jsdelivr.net/gh/${DEVELOPER_INFO.repo}@latest/package.json`;

interface GithubRelease {
  tag_name?: string;
  html_url?: string;
  body?: string | null;
}

interface GithubTag {
  name?: string;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function releaseUrl(tag: string): string {
  return `https://github.com/${DEVELOPER_INFO.repo}/releases/tag/${tag}`;
}

/** 查询最新版本；三个源都失败时抛错（调用方负责提示） */
export async function fetchLatestRelease(signal?: AbortSignal): Promise<UpdateInfo | null> {
  try {
    const release = await getJson<GithubRelease>(`${API}/releases/latest`, signal);
    if (release.tag_name) {
      return {
        version: release.tag_name,
        url: release.html_url ?? releaseUrl(release.tag_name),
        notes: release.body ?? null,
      };
    }
  } catch {
    // 落到下一个源
  }

  try {
    const tags = await getJson<GithubTag[]>(`${API}/tags`, signal);
    const first = tags?.[0];
    if (first?.name) return { version: first.name, url: releaseUrl(first.name), notes: null };
  } catch {
    // 落到下一个源
  }

  const pkg = await getJson<{ version?: string }>(JSDELIVR_PKG, signal);
  if (pkg.version) {
    return { version: pkg.version, url: releaseUrl(`v${pkg.version}`), notes: null };
  }
  return null;
}
