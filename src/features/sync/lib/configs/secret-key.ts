/**
 * 密钥 key 的格式（**纯逻辑**，冒烟可直接测）。
 *
 * SecureStore 在 Android Keystore 里不能带点，所以全部用下划线：
 * `vnlite_sync_<配置id>_<键名>`。
 *
 * 单独一个文件是为了让 `configs/storage` 这类要进 bun 冒烟的模块
 * 不被 `expo-secure-store`（依赖 react-native）拖进来。
 */

/** 密钥 key 的前缀 */
export const SECRET_PREFIX = "vnlite_sync_";

/** 目前用到的密钥键名 */
export const SECRET_KEYS = ["password", "refreshToken"] as const;

/** 完整的 SecureStore key */
export function secretKey(configId: string, key: string): string {
  return `${SECRET_PREFIX}${configId}_${key}`;
}
