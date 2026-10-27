/**
 * OneDrive 供应商（把 Graph 客户端包成统一的供应商接口）。
 */

import { t } from "@/lib/i18n/translate";

import type {
  ProviderContext,
  ProviderOptions,
  RemoteFileInfo,
  SyncProvider,
} from "@/features/sync/lib/providers/types";
import { getAvatar, getBackup, ONEDRIVE_CLIENT_ID_KEY, putBackup } from "./client";

/** 选项里的键 */
export { ONEDRIVE_CLIENT_ID_KEY };
export const ONEDRIVE_ACCOUNT_NAME_KEY = "accountName";
export const ONEDRIVE_ACCOUNT_EMAIL_KEY = "accountEmail";

export const ONEDRIVE_PROVIDER: SyncProvider = {
  meta: { id: "onedrive", labelKey: "sync.provider.onedrive", implemented: true },

  validate(options: ProviderOptions) {
    const clientId = (options[ONEDRIVE_CLIENT_ID_KEY] ?? "").trim();
    if (!clientId) return { ok: false, error: t("sync.onedrive.clientIdRequired") };
    const email = (options[ONEDRIVE_ACCOUNT_EMAIL_KEY] ?? "").trim();
    if (!email) return { ok: false, error: t("sync.onedrive.notConnected") };
    return {
      ok: true,
      options: {
        [ONEDRIVE_CLIENT_ID_KEY]: clientId,
        [ONEDRIVE_ACCOUNT_NAME_KEY]: (options[ONEDRIVE_ACCOUNT_NAME_KEY] ?? "").trim(),
        [ONEDRIVE_ACCOUNT_EMAIL_KEY]: email,
      },
    };
  },

  async putBackup(ctx: ProviderContext, body: string): Promise<RemoteFileInfo> {
    return putBackup(ctx, body);
  },

  async getBackup(ctx: ProviderContext) {
    return getBackup(ctx);
  },

  async getAvatar(ctx: ProviderContext): Promise<Uint8Array | null> {
    return getAvatar(ctx);
  },
};
