import { t } from "@/lib/i18n/translate";
import { AVATAR_FILE_NAME, BACKUP_FILE_NAME } from "../../backup";
import type { SyncProvider } from "../types";
import { upload, download } from "./client";

export const QUARK_PROVIDER: SyncProvider = {
  meta: { id: "quark", labelKey: "sync.provider.quark", implemented: true },
  validate(options) {
    const directory = (options.directory || "vnlite").trim();
    if (
      !directory ||
      directory.length > 100 ||
      /[\\/:*?"<>|]/.test(directory) ||
      [...directory].some((char) => char.charCodeAt(0) < 32) ||
      directory === "." ||
      directory === ".."
    )
      return { ok: false, error: t("sync.quark.invalidDirectory") };
    return { ok: true, options: { directory } };
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
