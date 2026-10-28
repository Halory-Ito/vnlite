/**
 * WebDAV 客户端（只用到同步备份需要的那几个动作）。
 *
 * ## 协议
 *
 * WebDAV 的备份其实就是**把文件 PUT / GET 到服务器目录里**：
 *   - 上传：`PUT {目录}/{文件名}`，正文是备份 JSON
 *   - 下载：`GET {目录}/{文件名}`
 * 认证用 **HTTP Basic**（用户名 + 密码）—— 最通用的一档
 * （坚果云、Nextcloud、ownCloud、群晖、WebDAV 客户端全支持）。
 *
 * ## 为什么不发 User-Agent
 *
 * RN 的 fetch 禁止自定义 `User-Agent` 头（OkHttp 会带默认 UA），别的头随便发。
 *
 * ## 超时自己实现
 *
 * `AbortSignal.timeout` 在 Hermes 上不可用（同 `features/walkthrough/lib/client`），
 * 这里用 `setTimeout` + 手动 `controller.abort()`。
 */

import { t } from "@/lib/i18n/translate";

import { basicAuthValue } from "@/features/sync/lib/base64";
import { AVATAR_FILE_NAME, BACKUP_DIR, BACKUP_FILE_NAME } from "@/features/sync/lib/backup";
import { request } from "@/features/sync/lib/providers/http";
import type { RemoteFileInfo } from "@/features/sync/lib/providers/types";

export interface WebDavConfig {
  /** 服务器**目录**地址，如 `https://dav.example.com/dav/files/user` */
  url: string;
  username: string;
  password: string;
}

/**
 * 校正服务器地址：必须是 http(s)，末尾斜杠去掉。
 *
 * 返回 null 表示地址不合法（调用方提示用户重填）。
 */
export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}

/** 目录地址 + 文件名 → 完整 URL */
export function joinUrl(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${name}`;
}

/** 认证头（没填用户名就不发 —— 有些服务器允许匿名） */
export function buildAuthHeaders(config: WebDavConfig): Record<string, string> {
  if (!config.username) return {};
  return { Authorization: basicAuthValue(config.username, config.password) };
}

/** 状态码 → 能看懂的错误 */
export function errorForStatus(status: number): Error {
  if (status === 401) return new Error(t("sync.unauthorized"));
  if (status === 403) return new Error(t("sync.forbidden"));
  if (status === 404) return new Error(t("sync.notFound"));
  if (status >= 500) return new Error(t("sync.serverError", { status: String(status) }));
  return new Error(t("sync.requestFailed", { status: String(status) }));
}

/** 云盘上的完整文件地址（`{目录}/vnlite/{文件名}`） */
export function remoteFileUrl(config: WebDavConfig, name: string): string {
  return joinUrl(joinUrl(config.url, BACKUP_DIR), name);
}

/** 老版本的同级地址（备份目录还没有的时候）；只用于**读取**回退 */
function legacyFileUrl(config: WebDavConfig, name: string): string {
  return joinUrl(config.url, name);
}

/**
 * 建备份目录（`MKCOL`）。
 *
 * WebDAV 的 `PUT` **不会**自动创建父目录，缺了就是 409 Conflict。
 * 已经存在时服务器会回 405 Method Not Allowed（RFC 4918），同样算成功。
 */
export async function ensureBackupDir(config: WebDavConfig): Promise<void> {
  const response = await request(joinUrl(config.url, BACKUP_DIR), {
    method: "MKCOL",
    headers: buildAuthHeaders(config),
  });
  // 201 建好了 / 405 已经有了；其它 2xx 也当成功
  if (response.ok || response.status === 405) return;
  throw errorForStatus(response.status);
}

/**
 * 上传备份。
 *
 * @param config 服务器配置
 * @param body 备份 JSON 字符串
 */
export async function putBackup(config: WebDavConfig, body: string): Promise<RemoteFileInfo> {
  // 先确保 `vnlite/` 在（PUT 不会自动建目录）
  await ensureBackupDir(config);
  const response = await request(remoteFileUrl(config, BACKUP_FILE_NAME), {
    method: "PUT",
    headers: {
      ...buildAuthHeaders(config),
      "Content-Type": "application/json; charset=utf-8",
    },
    body,
  });
  if (!response.ok) throw errorForStatus(response.status);
  return { size: body.length, modifiedAt: Date.now() };
}

/**
 * 下载备份。
 *
 * 服务器上没有这个文件时返回 null（不是错误 —— 只是还没上传过）。
 *
 * 顺序：先找 `vnlite/vnlite-backup.json`；没有就回退到老版本的同级
 * `vnlite-backup.json`（1.4.3 及以前的备份）—— 老用户的备份不会「凭空消失」。
 */
export async function getBackup(
  config: WebDavConfig
): Promise<{ body: string; info: RemoteFileInfo } | null> {
  const found = await fetchBackupAt(remoteFileUrl(config, BACKUP_FILE_NAME), config);
  if (found) return found;

  const legacy = await fetchBackupAt(legacyFileUrl(config, BACKUP_FILE_NAME), config);
  if (legacy) return legacy;
  return null;
}

/** 从指定地址取备份；404 返回 null */
async function fetchBackupAt(
  url: string,
  config: WebDavConfig
): Promise<{ body: string; info: RemoteFileInfo } | null> {
  const response = await request(url, { method: "GET", headers: buildAuthHeaders(config) });
  if (response.status === 404) return null;
  if (!response.ok) throw errorForStatus(response.status);

  const body = await response.text();
  const length = Number(response.headers.get("Content-Length"));
  const modified = response.headers.get("Last-Modified");
  const modifiedAt = modified ? Date.parse(modified) : Number.NaN;
  return {
    body,
    info: {
      size: Number.isFinite(length) && length > 0 ? length : body.length,
      modifiedAt: Number.isFinite(modifiedAt) ? modifiedAt : null,
    },
  };
}

/**
 * 下载头像。
 *
 * 服务器上没有这个文件时返回 null（沿用备份的语义：没传过不是错误）。
 * 同样从 `vnlite/` 找，找不到再回退到老版本的同级文件。
 *
 * 上传那半在 `file.ts`（要用原生上传，bun 里跑不了）；
 * 这里是纯 fetch，冒烟脚本也能覆盖。
 */
export async function getAvatar(config: WebDavConfig): Promise<Uint8Array | null> {
  const urls = [remoteFileUrl(config, AVATAR_FILE_NAME), legacyFileUrl(config, AVATAR_FILE_NAME)];
  for (const url of urls) {
    const response = await request(url, {
      method: "GET",
      headers: buildAuthHeaders(config),
    });
    if (response.status === 404) continue;
    if (!response.ok) throw errorForStatus(response.status);
    return new Uint8Array(await response.arrayBuffer());
  }
  return null;
}
