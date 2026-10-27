/**
 * OneDrive 授权：**设备码流程**（RFC 8628）。
 *
 * ## 为什么用设备码而不是「授权码 + 回调」
 *
 * 授权码流程要一个**回调地址**（redirect uri）：移动端得注册自定义 scheme，
 * 还得装 expo-web-browser 之类的原生依赖，Expo Go 里也未必能跑。
 * 设备码流程只要一个 client_id：应用里显示一串码 → 用户在浏览器里输码授权 →
 * 应用轮询拿 token。纯 fetch + `Linking` 就够，**不新增任何原生依赖**。
 *
 * ## 前提
 *
 * Azure 应用注册里要打开「允许公共客户端流」（Allow public client flows），
 * 否则设备码接口直接返回 `unauthorized_client`。
 */

import { t } from "@/lib/i18n/translate";

import { ONEDRIVE_ENDPOINTS } from "./endpoints";

/** 设备码接口（端点在调用时才取 —— 换端点后立刻生效） */
function deviceCodeUrl(): string {
  return `${ONEDRIVE_ENDPOINTS.login}/devicecode`;
}

/** 令牌接口 */
function tokenUrl(): string {
  return `${ONEDRIVE_ENDPOINTS.login}/token`;
}

/** 申请的权限：读写文件 + 离线刷新 + 读账号信息 */
export const ONEDRIVE_SCOPES = "Files.ReadWrite offline_access User.Read";

/** 设备码默认有效期（接口没给 expires_in 时的兜底，秒） */
const DEFAULT_EXPIRES_IN = 900;
/** 设备码默认轮询间隔（接口没给 interval 时的兜底，秒） */
const DEFAULT_INTERVAL = 5;

export interface DeviceCodeInfo {
  /** 拿 token 时要带的机器码（不给用户看） */
  deviceCode: string;
  /** 给用户看的码 */
  userCode: string;
  /** 验证页面地址 */
  verificationUri: string;
  /** 验证页面地址（带上了码，能少输一次） */
  verificationUriComplete: string;
  /** 轮询间隔（毫秒） */
  intervalMs: number;
  /** 有效期（毫秒） */
  expiresInMs: number;
}

export interface OneDriveToken {
  accessToken: string;
  refreshToken: string;
  /** 访问令牌过期时间（unix 毫秒） */
  expiresAt: number;
}

export interface OneDriveAccount {
  /** 显示名 */
  name: string;
  /** 邮箱（个人账号可能没有 mail，退回 userPrincipalName） */
  email: string;
}

/* -------------------------------------------------------------------------- */
/* 小工具                                                                      */
/* -------------------------------------------------------------------------- */

function formBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 错误响应 → 人话 */
async function oauthError(response: Response): Promise<Error> {
  const raw = await readJson(response);
  const description = str(raw.error_description) || str(raw.error);
  if (description.includes("unauthorized_client")) {
    return new Error(t("sync.onedrive.publicClientDisabled"));
  }
  // 刷新令牌失效（用户改密码 / 撤销了授权 / 太久没用）
  if (description.includes("invalid_grant")) {
    return new Error(t("sync.onedrive.tokenExpired"));
  }
  return new Error(description || t("sync.onedrive.authFailed"));
}

/* -------------------------------------------------------------------------- */
/* 设备码流程                                                                  */
/* -------------------------------------------------------------------------- */

/** 申请一个设备码（应用里显示码，用户去浏览器输） */
export async function requestDeviceCode(clientId: string): Promise<DeviceCodeInfo> {
  const response = await fetch(deviceCodeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({ client_id: clientId, scope: ONEDRIVE_SCOPES }),
  });
  if (!response.ok) throw await oauthError(response);

  const raw = await readJson(response);
  const deviceCode = str(raw.device_code);
  const userCode = str(raw.user_code);
  if (!deviceCode || !userCode) throw new Error(t("sync.onedrive.authFailed"));

  const verificationUri = str(raw.verification_uri);
  return {
    deviceCode,
    userCode,
    verificationUri: verificationUri || "https://microsoft.com/devicelogin",
    verificationUriComplete: str(raw.verification_uri_complete),
    intervalMs: Math.max(1, num(raw.interval, DEFAULT_INTERVAL)) * 1000,
    expiresInMs: num(raw.expires_in, DEFAULT_EXPIRES_IN) * 1000,
  };
}

/**
 * 轮询换 token。
 *
 * `authorization_pending` = 用户还没在浏览器里确认（继续等）；
 * `slow_down` = 轮询太快（间隔加 5 秒）；其余都是真错误。
 *
 * 用户中途取消（`isCancelled` 返回 true）时返回 null —— 不当成错误。
 */
export async function pollForToken(
  clientId: string,
  deviceCode: string,
  intervalMs: number,
  deadlineAt: number,
  isCancelled?: () => boolean
): Promise<OneDriveToken | null> {
  let interval = intervalMs;
  while (Date.now() < deadlineAt) {
    await sleep(interval);
    if (isCancelled?.()) return null;
    const response = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
      }),
    });

    if (response.ok) return parseToken(await readJson(response));

    const raw = await readJson(response);
    const code = str(raw.error);
    if (code === "authorization_pending") continue;
    if (code === "slow_down") {
      interval += 5000;
      continue;
    }
    if (code === "expired_token") throw new Error(t("sync.onedrive.authExpired"));
    if (code === "access_denied") throw new Error(t("sync.onedrive.authDenied"));
    throw new Error(str(raw.error_description) || t("sync.onedrive.authFailed"));
  }
  throw new Error(t("sync.onedrive.authExpired"));
}

/** 用刷新令牌换一个新的访问令牌 */
export async function refreshAccessToken(
  clientId: string,
  refreshToken: string
): Promise<OneDriveToken> {
  const response = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw await oauthError(response);
  return parseToken(await readJson(response));
}

function parseToken(raw: Record<string, unknown>): OneDriveToken {
  const accessToken = str(raw.access_token);
  if (!accessToken) throw new Error(t("sync.onedrive.authFailed"));
  return {
    accessToken,
    refreshToken: str(raw.refresh_token),
    expiresAt: Date.now() + num(raw.expires_in, 3600) * 1000,
  };
}

/** 读账号信息（显示「连的是哪个账号」） */
export async function fetchAccount(accessToken: string): Promise<OneDriveAccount> {
  const response = await fetch(
    `${ONEDRIVE_ENDPOINTS.graph}/me?$select=displayName,mail,userPrincipalName`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(t("sync.onedrive.authFailed"));
  const raw = await readJson(response);
  const principal = str(raw.userPrincipalName);
  return {
    name: str(raw.displayName) || principal,
    email: str(raw.mail) || principal,
  };
}
