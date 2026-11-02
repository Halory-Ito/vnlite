import { t } from "@/lib/i18n/translate";
import { AVATAR_FILE_NAME, BACKUP_FILE_NAME } from "../../backup";
import type { SyncProvider } from "../types";
import { credentials } from "./config";
import { download, upload } from "./client";
export const BAIDU_PROVIDER: SyncProvider = {
  meta: { id: "baidunetdisk", labelKey: "sync.provider.baidunetdisk", implemented: true },
  validate(options) {
    const config = credentials();
    if (!config.appKey || !config.secretKey)
      return { ok: false, error: t("sync.baidu.configMissing") };
    const rootPath = (options.rootPath || "/apps/vnlite").trim().replace(/\/+$/, "");
    if (
      !/^\/apps\/[^/]+(?:\/[^/]+)*$/.test(rootPath) ||
      rootPath.split("/").some((part) => part === "." || part === "..")
    )
      return { ok: false, error: t("sync.baidu.invalidPath") };
    return { ok: true, options: { rootPath } };
  },
  putBackup: (ctx, body) => upload(ctx, BACKUP_FILE_NAME, new TextEncoder().encode(body)),
  async getBackup(ctx) {
    const result = await download(ctx, BACKUP_FILE_NAME);
    return result ? { body: new TextDecoder().decode(result.bytes), info: result.info } : null;
  },
  async getAvatar(ctx) {
    return (await download(ctx, AVATAR_FILE_NAME))?.bytes ?? null;
  },
};
