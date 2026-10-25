/**
 * WebDAV 服务器配置。
 *
 * - **地址 / 用户名** → AsyncStorage（`lib/storage/key-value`）
 * - **密码** → `expo-secure-store`（Keychain / Android Keystore）
 *
 * 密码不进 AsyncStorage：那是明文存储，备份文件与系统备份都可能把它带出去。
 */

import { kv } from "@/lib/storage/key-value";
import { deleteSecureValue, readSecureValue, writeSecureValue } from "@/lib/storage/secure";

const CONFIG_KEY = "vnlite.sync.server";
/** 上次同步成功的时间 */
const LAST_SYNC_KEY = "vnlite.sync.last_at";
/** SecureStore 的 key：Android Keystore 里带点的 key 需要额外处理，这里避开点号 */
const PASSWORD_KEY = "vnlite_webdav_password";

export interface SyncServerConfig {
  /** 服务器目录地址 */
  url: string;
  username: string;
}

export async function readServerConfig(): Promise<SyncServerConfig | null> {
  const stored = await kv.get<Partial<SyncServerConfig>>(CONFIG_KEY);
  if (!stored) return null;
  const url = typeof stored.url === "string" ? stored.url : "";
  const username = typeof stored.username === "string" ? stored.username : "";
  if (!url && !username) return null;
  return { url, username };
}

export async function saveServerConfig(config: SyncServerConfig): Promise<void> {
  await kv.set<SyncServerConfig>(CONFIG_KEY, {
    url: config.url,
    username: config.username,
  });
}

export async function clearServerConfig(): Promise<void> {
  await kv.remove(CONFIG_KEY);
  await deleteSecureValue(PASSWORD_KEY);
}

/** 读密码（取不到是空串，不是 null —— 表单里直接用） */
export async function readPassword(): Promise<string> {
  return (await readSecureValue(PASSWORD_KEY)) ?? "";
}

/** 写密码（空串 = 清掉） */
export async function writePassword(password: string): Promise<void> {
  if (!password) {
    await deleteSecureValue(PASSWORD_KEY);
    return;
  }
  await writeSecureValue(PASSWORD_KEY, password);
}

/** 上次同步成功的时间（unix 毫秒）；没同步过是 null */
export async function readLastSyncAt(): Promise<number | null> {
  const stored = await kv.get<number>(LAST_SYNC_KEY);
  return typeof stored === "number" && Number.isFinite(stored) ? stored : null;
}

export async function writeLastSyncAt(at: number): Promise<void> {
  await kv.set(LAST_SYNC_KEY, at);
}
