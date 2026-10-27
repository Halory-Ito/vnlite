/**
 * 多份同步配置的存储。
 *
 * - 配置本体（名称 / 供应商 / 选项 / 上次同步时间）→ AsyncStorage
 * - 密钥（密码 / 刷新令牌）→ SecureStore（见 `secrets.ts`）
 *
 * ## 纯逻辑
 *
 * 这个文件只碰 KV，**不 import SecureStore** —— 迁移旧版配置那部分
 * 拆到了 `migrate.ts`，这样本文件能进 bun 冒烟。
 */

import { kv } from "@/lib/storage/key-value";

import type { ProviderOptions, SyncProviderId } from "@/features/sync/lib/providers/types";
import type { SyncConfig } from "./types";

/** 配置列表 */
const CONFIGS_KEY = "vnlite.sync.configs";
/** 当前使用的配置 id */
const ACTIVE_KEY = "vnlite.sync.active";

const PROVIDER_IDS = new Set<SyncProviderId>(["webdav", "onedrive", "googledrive", "quark"]);

/* -------------------------------------------------------------------------- */
/* 读 / 写                                                                     */
/* -------------------------------------------------------------------------- */

/** 读全部配置 */
export async function readConfigs(): Promise<SyncConfig[]> {
  const stored = await kv.get<unknown>(CONFIGS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.map(parseConfig).filter(isConfig);
}

/** 写全部配置 */
export async function writeConfigs(configs: SyncConfig[]): Promise<void> {
  await kv.set<SyncConfig[]>(CONFIGS_KEY, configs);
}

/** 当前使用的配置 id */
export async function readActiveId(): Promise<string | null> {
  const stored = await kv.get<string>(ACTIVE_KEY);
  return typeof stored === "string" && stored ? stored : null;
}

/** 设置当前使用的配置 id */
export async function writeActiveId(id: string | null): Promise<void> {
  if (!id) {
    await kv.remove(ACTIVE_KEY);
    return;
  }
  await kv.set(ACTIVE_KEY, id);
}

/* -------------------------------------------------------------------------- */
/* 解析（容错）                                                                */
/* -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseOptions(value: unknown): ProviderOptions {
  const record = asRecord(value);
  const options: ProviderOptions = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === "string") options[key] = item;
  }
  return options;
}

/** 一条配置坏掉就丢掉那一条，不影响其它配置 */
export function parseConfig(value: unknown): SyncConfig | null {
  const record = asRecord(value);
  const id = typeof record.id === "string" ? record.id : "";
  const provider = record.provider;
  if (!id || typeof provider !== "string") return null;
  if (!PROVIDER_IDS.has(provider as SyncProviderId)) return null;
  const lastSyncAt = record.lastSyncAt;
  const createdAt = record.createdAt;
  return {
    id,
    name: typeof record.name === "string" ? record.name : "",
    provider: provider as SyncProviderId,
    options: parseOptions(record.options),
    lastSyncAt: typeof lastSyncAt === "number" && Number.isFinite(lastSyncAt) ? lastSyncAt : null,
    createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : 0,
  };
}

function isConfig(value: SyncConfig | null): value is SyncConfig {
  return value !== null;
}
