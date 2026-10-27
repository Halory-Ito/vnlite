/**
 * 版本号解析与比较（纯函数，冒烟直接测）。
 *
 * 「检查更新」拿到的是 GitHub 的 tag（如 `v1.2.1`），当前版本来自 `app.json`
 * （如 `1.2.1`），两者都可能带前缀 / 后缀（`v` / `-beta.1`），这里只取前三段数字。
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

/** `v1.2.1` / `1.2.1-beta.2` / `1.2` → `{1,2,1}`；解析不出返回 null */
export function parseVersion(raw: string | null | undefined): Version | null {
  if (!raw) return null;
  const match = raw.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i);
  if (!match) return null;
  return {
    major: Number(match[1] ?? 0),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

/** `latest` 是否比 `current` 新（任一解析失败都返回 false） */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}
