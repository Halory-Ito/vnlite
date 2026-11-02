import { t } from "@/lib/i18n/translate";
import { request } from "../http";
import type { ProviderContext } from "../types";
import { credentials } from "./config";

export const TOKEN_KEYS = ["accessToken", "refreshToken", "tokenExpiresAt"] as const;
const refreshing = new Map<string, Promise<string>>();
export function authorizationUrl(): string {
  const config = credentials();
  if (!config.appKey || !config.secretKey) throw new Error(t("sync.baidu.configMissing"));
  return `https://openapi.baidu.com/oauth/2.0/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: config.appKey,
    redirect_uri: config.redirectUri,
    scope: "basic,netdisk",
    display: "mobile",
  })}`;
}
async function exchange(ctx: ProviderContext, fields: Record<string, string>): Promise<string> {
  const config = credentials();
  if (!config.appKey || !config.secretKey) throw new Error(t("sync.baidu.configMissing"));
  const response = await request("https://openapi.baidu.com/oauth/2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...fields,
      client_id: config.appKey,
      client_secret: config.secretKey,
    }).toString(),
  });
  const data = await response.json();
  if (
    !response.ok ||
    data.error ||
    typeof data.access_token !== "string" ||
    typeof data.refresh_token !== "string" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0
  ) {
    throw new Error(t("sync.baidu.authFailed"));
  }
  // Commit the rotated refresh token before the access token so interrupted writes can recover.
  await ctx.secrets.set("refreshToken", data.refresh_token);
  await ctx.secrets.set("tokenExpiresAt", String(Date.now() + data.expires_in * 1000));
  await ctx.secrets.set("accessToken", data.access_token);
  return data.access_token;
}
export async function authorize(ctx: ProviderContext, code: string): Promise<void> {
  if (!code.trim()) throw new Error(t("sync.baidu.codeRequired"));
  await exchange(ctx, {
    grant_type: "authorization_code",
    code: code.trim(),
    redirect_uri: credentials().redirectUri,
  });
}
export async function accessToken(ctx: ProviderContext, force = false): Promise<string> {
  const pending = refreshing.get(ctx.configId);
  if (pending) return pending;
  const token = await ctx.secrets.get("accessToken");
  const expiry = Number(await ctx.secrets.get("tokenExpiresAt"));
  if (!force && token && expiry > Date.now() + 60000) return token;
  const refresh = await ctx.secrets.get("refreshToken");
  if (!refresh) throw new Error(t("sync.baidu.notConnected"));
  const task = exchange(ctx, { grant_type: "refresh_token", refresh_token: refresh });
  refreshing.set(ctx.configId, task);
  try {
    return await task;
  } finally {
    refreshing.delete(ctx.configId);
  }
}
