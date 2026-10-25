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
 * `AbortSignal.timeout` 在 Hermes 上不可用（同 `features/walkthrough/client`），
 * 这里用 `setTimeout` + 手动 `controller.abort()`。
 */

import { t } from "@/lib/i18n/translate";

import { basicAuthValue } from "./base64";
import { AVATAR_FILE_NAME, BACKUP_FILE_NAME } from "./backup";

/** 单次请求超时（备份可能几 MB，慢网络留够时间） */
const TIMEOUT_MS = 60_000;

export interface WebDavConfig {
  /** 服务器**目录**地址，如 `https://dav.example.com/dav/files/user` */
  url: string;
  username: string;
  password: string;
}

/** 服务器上那个文件的信息 */
export interface RemoteFileInfo {
  /** 字节数 */
  size: number;
  /** 最后修改时间（unix 毫秒）；服务器没给 `Last-Modified` 时为 null */
  modifiedAt: number | null;
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

async function request(
  url: string,
  init: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(t("sync.timeout"), { cause: error });
    throw new Error(t("sync.networkError"), { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 上传备份。
 *
 * @param config 服务器配置
 * @param body 备份 JSON 字符串
 */
export async function putBackup(config: WebDavConfig, body: string): Promise<RemoteFileInfo> {
  const url = joinUrl(config.url, BACKUP_FILE_NAME);
  const response = await request(url, {
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
 */
export async function getBackup(
  config: WebDavConfig
): Promise<{ body: string; info: RemoteFileInfo } | null> {
  const url = joinUrl(config.url, BACKUP_FILE_NAME);
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
 *
 * 上传那半在 `webdav-file.ts`（要用原生上传，bun 里跑不了）；
 * 这里是纯 fetch，冒烟脚本也能覆盖。
 */
export async function getAvatar(config: WebDavConfig): Promise<Uint8Array | null> {
  const response = await request(joinUrl(config.url, AVATAR_FILE_NAME), {
    method: "GET",
    headers: buildAuthHeaders(config),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw errorForStatus(response.status);
  return new Uint8Array(await response.arrayBuffer());
}
