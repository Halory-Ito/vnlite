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
import { t } from "@/lib/i18n/translate";
import { SECRET_KEYS, secretKey } from "./secret-key";

async function secureOperation<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (!key.startsWith("quark")) return action();
  try {
    return await action();
  } catch {
    throw new Error(t("sync.quark.storageFailed"));
  }
}

/** 绑定了配置 id 的密钥存取 */
export function secretStoreFor(configId: string): SyncSecretStore {
  return {
    get: (key: string) =>
      secureOperation(key, () =>
        readSecureValue(secretKey(configId, key), key.startsWith("quark"))
      ),
    set: (key: string, value: string) =>
      secureOperation(key, () =>
        writeSecureValue(secretKey(configId, key), value, key.startsWith("quark"))
      ),
    remove: (key: string) =>
      secureOperation(key, () =>
        deleteSecureValue(secretKey(configId, key), key.startsWith("quark"))
      ),
  };
}

/** 删掉一份配置的全部密钥（配置被删除时调用） */
export async function clearConfigSecrets(configId: string): Promise<void> {
  for (const key of SECRET_KEYS) {
    await deleteSecureValue(secretKey(configId, key), key.startsWith("quark"));
  }
}
