/**
 * 同步供应商的抽象（WebDAV / OneDrive / …）。
 *
 * ## 为什么要抽象
 *
 * 「同步」页要同时支持多家网盘：每家的认证方式、上传下载接口都不一样，
 * 但**备份包格式、恢复流程、界面**是同一套。所以这里把「怎么存」抽象成
 * 一个供应商接口，页面只认接口，不认具体是哪家。
 *
 * ## 分层
 *
 * - `client.ts` 一类：**纯 fetch**，可以在 bun 里冒烟
 * - `file.ts` 一类：要 `expo-file-system` 原生上传（头像是二进制，不进 bun 冒烟）
 */

import type { TranslationKey } from "@/lib/i18n/translate";

/** 供应商 id */
export type SyncProviderId = "webdav" | "onedrive" | "googledrive" | "quark";

/** 供应商元信息 */
export interface SyncProviderMeta {
  id: SyncProviderId;
  /** 显示名（i18n key） */
  labelKey: TranslationKey;
  /** 是否已实现（没实现的只在选择列表里占位） */
  implemented: boolean;
}

/** 供应商选项（各家自己解释，键值都是字符串） */
export type ProviderOptions = Record<string, string>;

/**
 * 密钥存取（实例绑定了配置 id —— 同一份密码不能跨配置复用）。
 *
 * 密码 / 刷新令牌都进 SecureStore，AsyncStorage 是明文的。
 */
export interface SyncSecretStore {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

/** 调供应商时的上下文 */
export interface ProviderContext {
  /** 供应商 id */
  provider: SyncProviderId;
  /** 配置 id（密钥按它隔离） */
  configId: string;
  /** 供应商选项 */
  options: ProviderOptions;
  /** 密钥存取 */
  secrets: SyncSecretStore;
}

/** 远端文件信息 */
export interface RemoteFileInfo {
  /** 字节数 */
  size: number;
  /** 最后修改时间（unix 毫秒）；拿不到时 null */
  modifiedAt: number | null;
}

/** 校验结果：合法时给出**规范化后**的选项 */
export type ProviderValidation =
  | { ok: true; options: ProviderOptions }
  | { ok: false; error: string };

/** 供应商实现 */
export interface SyncProvider {
  meta: SyncProviderMeta;
  /** 校验并规范化表单填的选项 */
  validate: (options: ProviderOptions) => ProviderValidation;
  /** 上传备份正文 */
  putBackup: (ctx: ProviderContext, body: string) => Promise<RemoteFileInfo>;
  /** 下载备份正文；服务器上没有时返回 null（不是错误） */
  getBackup: (ctx: ProviderContext) => Promise<{ body: string; info: RemoteFileInfo } | null>;
  /** 下载头像；服务器上没有时返回 null */
  getAvatar: (ctx: ProviderContext) => Promise<Uint8Array | null>;
}
