/**
 * WebDAV 供应商（把 `client.ts` 的纯 fetch 包成统一的供应商接口）。
 */

import { t } from "@/lib/i18n/translate";

import type {
  ProviderContext,
  ProviderOptions,
  RemoteFileInfo,
  SyncProvider,
} from "@/features/sync/lib/providers/types";
import { getAvatar, getBackup, normalizeServerUrl, putBackup, type WebDavConfig } from "./client";

/** 密码在密钥库里的键名 */
export const WEBDAV_PASSWORD_KEY = "password";

/** 选项里的键 */
export const WEBDAV_URL_KEY = "url";
export const WEBDAV_USERNAME_KEY = "username";

/** 把上下文还原成客户端要的配置（密码在 SecureStore 里，要异步读） */
export async function webdavConfigOf(ctx: ProviderContext): Promise<WebDavConfig> {
  const password = (await ctx.secrets.get(WEBDAV_PASSWORD_KEY)) ?? "";
  return {
    url: ctx.options[WEBDAV_URL_KEY] ?? "",
    username: ctx.options[WEBDAV_USERNAME_KEY] ?? "",
    password,
  };
}

export const WEBDAV_PROVIDER: SyncProvider = {
  meta: { id: "webdav", labelKey: "sync.provider.webdav", implemented: true },

  validate(options: ProviderOptions) {
    const url = normalizeServerUrl(options[WEBDAV_URL_KEY] ?? "");
    if (!url) return { ok: false, error: t("sync.invalidUrl") };
    return {
      ok: true,
      options: {
        [WEBDAV_URL_KEY]: url,
        [WEBDAV_USERNAME_KEY]: (options[WEBDAV_USERNAME_KEY] ?? "").trim(),
      },
    };
  },

  async putBackup(ctx: ProviderContext, body: string): Promise<RemoteFileInfo> {
    return putBackup(await webdavConfigOf(ctx), body);
  },

  async getBackup(ctx: ProviderContext) {
    return getBackup(await webdavConfigOf(ctx));
  },

  async getAvatar(ctx: ProviderContext): Promise<Uint8Array | null> {
    return getAvatar(await webdavConfigOf(ctx));
  },
};
