/**
 * 旧版单配置 → 多份配置的迁移。
 *
 * 1.4.x 只有一份 WebDAV 配置（`vnlite.sync.server` + SecureStore 里的密码）。
 * 升级后第一次进「同步」页时，把它转成一份 WebDAV 配置 ——
 * 用户不用重新填地址和密码。
 *
 * 单独一个文件是因为它要用 SecureStore（依赖 react-native），
 * 而 `configs/storage` 要能进 bun 冒烟。
 */

import { kv } from "@/lib/storage/key-value";
import { deleteSecureValue, readSecureValue, writeSecureValue } from "@/lib/storage/secure";
import { t } from "@/lib/i18n/translate";

import { secretKey } from "./secret-key";
import { writeActiveId, writeConfigs } from "./storage";
import { createConfigId, type SyncConfig } from "./types";

/* ---- 旧版的 key ---- */
const LEGACY_CONFIG_KEY = "vnlite.sync.server";
const LEGACY_LAST_SYNC_KEY = "vnlite.sync.last_at";
const LEGACY_PASSWORD_KEY = "vnlite_webdav_password";

/**
 * 把旧版那一份 WebDAV 配置搬过来。
 *
 * 没有旧配置（或已经搬过了）返回空数组 —— 调用方直接读新配置列表。
 */
export async function migrateLegacyConfig(): Promise<SyncConfig[]> {
  const legacy = await kv.get<{ url?: string; username?: string }>(LEGACY_CONFIG_KEY);
  const url = typeof legacy?.url === "string" ? legacy.url : "";
  if (!url) return [];

  const id = createConfigId();
  const password = await readSecureValue(LEGACY_PASSWORD_KEY);
  if (password) await writeSecureValue(secretKey(id, "password"), password);
  const lastSyncAt = await kv.get<number>(LEGACY_LAST_SYNC_KEY);

  const config: SyncConfig = {
    id,
    name: t("sync.provider.webdav"),
    provider: "webdav",
    options: { url, username: typeof legacy?.username === "string" ? legacy.username : "" },
    lastSyncAt: typeof lastSyncAt === "number" && Number.isFinite(lastSyncAt) ? lastSyncAt : null,
    createdAt: Date.now(),
  };
  await writeConfigs([config]);
  await writeActiveId(id);

  // 搬完就把旧键删掉：否则用户以后把配置全删了，下次启动又会把旧配置变回来
  await kv.remove(LEGACY_CONFIG_KEY);
  await kv.remove(LEGACY_LAST_SYNC_KEY);
  await deleteSecureValue(LEGACY_PASSWORD_KEY);

  return [config];
}
