/**
 * 同步配置的密钥存取。
 *
 * 密码 / 刷新令牌一律进 **SecureStore**（Keychain / Android Keystore）——
 * AsyncStorage 是明文的，备份文件与系统备份都可能把它带出去。
 *
 * key 的格式见 `secret-key.ts`（纯逻辑，单独一个文件是为了不把
 * `expo-secure-store` 带进 bun 冒烟）。
 */

import { deleteSecureValue, readSecureValue, writeSecureValue } from "@/lib/storage/secure";

import type { SyncSecretStore } from "@/features/sync/lib/providers/types";
import { SECRET_KEYS, secretKey } from "./secret-key";

/** 绑定了配置 id 的密钥存取 */
export function secretStoreFor(configId: string): SyncSecretStore {
  return {
    get: (key: string) => readSecureValue(secretKey(configId, key)),
    set: (key: string, value: string) => writeSecureValue(secretKey(configId, key), value),
    remove: (key: string) => deleteSecureValue(secretKey(configId, key)),
  };
}

/** 删掉一份配置的全部密钥（配置被删除时调用） */
export async function clearConfigSecrets(configId: string): Promise<void> {
  for (const key of SECRET_KEYS) {
    await deleteSecureValue(secretKey(configId, key));
  }
}
