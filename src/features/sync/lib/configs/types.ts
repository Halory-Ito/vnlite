/**
 * 一份同步配置（= 一台服务器的认证信息）。
 *
 * 「同步」页支持**多份配置**：每份配置自己一套凭据、自己的备份文件，
 * 互不干扰（坚果云一份、OneDrive 一份）。
 */

import type { ProviderOptions, SyncProviderId } from "../providers/types";

export interface SyncConfig {
  /** 配置 id（同时是密钥的隔离键） */
  id: string;
  /** 配置名称（用户自己起，如「我的坚果云」） */
  name: string;
  /** 供应商 */
  provider: SyncProviderId;
  /** 供应商特有选项（地址 / 用户名 / 应用 ID …） */
  options: ProviderOptions;
  /** 上次同步成功的时间（unix 毫秒）；没同步过是 null */
  lastSyncAt: number | null;
  /** 创建时间（unix 毫秒） */
  createdAt: number;
}

/**
 * 生成配置 id。
 *
 * 只用字母数字 —— SecureStore 的 key 在 Android Keystore 里不能带点，
 * 这里连分隔符都用下划线之外的字符，免得以后拼 key 出岔子。
 */
export function createConfigId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
