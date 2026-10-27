/**
 * OneDrive 客户端（Microsoft Graph）。
 *
 * ## 用哪套接口
 *
 * Graph 的「简单上传」够用：备份文件几 MB，直接
 * `PUT /me/drive/root:/vnlite-backup.json:/content` 传原始字节，
 * 不用分片会话（那套要三步，容易中途失败）。
 *
 * ## 访问令牌
 *
 * 访问令牌**只留在内存**（几分钟就过期），SecureStore 里只放刷新令牌 ——
 * 拿到刷新令牌就能随时换新的访问令牌，够用了。
 */

import { t } from "@/lib/i18n/translate";

import { AVATAR_FILE_NAME, BACKUP_FILE_NAME } from "@/features/sync/lib/backup";
import { request } from "@/features/sync/lib/providers/http";
import type { ProviderContext, RemoteFileInfo } from "@/features/sync/lib/providers/types";
import { ONEDRIVE_ENDPOINTS } from "./endpoints";
import { refreshAccessToken } from "./oauth";

/** 刷新令牌在密钥库里的键名 */
export const ONEDRIVE_REFRESH_KEY = "refreshToken";

/** 选项里的键：Azure 应用 ID（客户端也要用，所以放这里） */
export const ONEDRIVE_CLIENT_ID_KEY = "clientId";

/** 访问令牌缓存（内存）：配置 id → 令牌 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** 令牌提前 1 分钟就当过期（宁可多换一次也别卡在请求上） */
const EXPIRY_MARGIN_MS = 60_000;

function fileUrl(name: string): string {
  return `${ONEDRIVE_ENDPOINTS.graph}/me/drive/root:/${name}:/content`;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clientIdOf(ctx: ProviderContext): string {
  return (ctx.options[ONEDRIVE_CLIENT_ID_KEY] ?? "").trim();
}

/** 断开连接 / 配置被删时忘掉缓存里的令牌 */
export function forgetAccessToken(configId: string): void {
  tokenCache.delete(configId);
}

/** 拿一个可用的访问令牌（缓存没有或快过期就用刷新令牌换） */
export async function accessToken(ctx: ProviderContext): Promise<string> {
  const cached = tokenCache.get(ctx.configId);
  if (cached && cached.expiresAt - Date.now() > EXPIRY_MARGIN_MS) return cached.token;

  const refreshToken = await ctx.secrets.get(ONEDRIVE_REFRESH_KEY);
  if (!refreshToken) throw new Error(t("sync.onedrive.notConnected"));

  const token = await refreshAccessToken(clientIdOf(ctx), refreshToken);
  // 微软可能返回新的刷新令牌，也可能不返回 —— 不返回就沿用旧的
  if (token.refreshToken) await ctx.secrets.set(ONEDRIVE_REFRESH_KEY, token.refreshToken);
  tokenCache.set(ctx.configId, { token: token.accessToken, expiresAt: token.expiresAt });
  return token.accessToken;
}

/** Graph 的错误响应 → 人话 */
async function graphError(response: Response): Promise<Error> {
  if (response.status === 401) return new Error(t("sync.onedrive.tokenExpired"));
  if (response.status === 403) return new Error(t("sync.onedrive.forbidden"));
  if (response.status === 404) return new Error(t("sync.notFound"));
  if (response.status >= 500)
    return new Error(t("sync.serverError", { status: String(response.status) }));
  return new Error(t("sync.requestFailed", { status: String(response.status) }));
}

/** 上传备份正文 */
export async function putBackup(ctx: ProviderContext, body: string): Promise<RemoteFileInfo> {
  const token = await accessToken(ctx);
  const response = await request(fileUrl(BACKUP_FILE_NAME), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body,
  });
  if (!response.ok) throw await graphError(response);

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const modified = str(raw.lastModifiedDateTime);
  const modifiedAt = modified ? Date.parse(modified) : Number.NaN;
  return {
    size: num(raw.size, body.length),
    modifiedAt: Number.isFinite(modifiedAt) ? modifiedAt : Date.now(),
  };
}

/** 下载备份正文；云盘上没有这个文件时返回 null */
export async function getBackup(
  ctx: ProviderContext
): Promise<{ body: string; info: RemoteFileInfo } | null> {
  const token = await accessToken(ctx);
  const response = await request(fileUrl(BACKUP_FILE_NAME), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await graphError(response);

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

/** 下载头像；云盘上没有时返回 null */
export async function getAvatar(ctx: ProviderContext): Promise<Uint8Array | null> {
  const token = await accessToken(ctx);
  const response = await request(fileUrl(AVATAR_FILE_NAME), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await graphError(response);
  return new Uint8Array(await response.arrayBuffer());
}

/** 上传头像用的地址（原生上传那边用） */
export function avatarUploadUrl(): string {
  return fileUrl(AVATAR_FILE_NAME);
}
