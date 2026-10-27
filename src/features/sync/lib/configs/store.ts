/**
 * 同步配置的**共享状态**（模块级单例）。
 *
 * 「同步」页与「新建 / 编辑配置」页是两个路由，要看到同一份配置列表 ——
 * 状态不能各自放在 hook 的 `useState` 里，所以放模块级，配 `useSyncExternalStore`
 * 订阅（同 `lib/storage/preferences` 的做法）。
 */

import { forgetAccessToken } from "@/features/sync/lib/providers/onedrive/client";
import { migrateLegacyConfig } from "./migrate";
import { clearConfigSecrets } from "./secrets";
import { readActiveId, readConfigs, writeActiveId, writeConfigs } from "./storage";
import type { SyncConfig } from "./types";

let configs: SyncConfig[] = [];
let activeId: string | null = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 订阅配置变化 */
export function subscribeConfigs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 当前配置列表（引用稳定：变了就整个换掉） */
export function getConfigs(): SyncConfig[] {
  return configs;
}

/** 当前使用的配置 id */
export function getActiveId(): string | null {
  return activeId;
}

/** 读一次（从 KV）；已经读过就直接返回 */
export function loadConfigs(): Promise<void> {
  if (loaded) return Promise.resolve();
  loadPromise ??= (async () => {
    // 旧版只有一份 WebDAV 配置 —— 先试着搬过来
    const migrated = await migrateLegacyConfig();
    const list = migrated.length > 0 ? migrated : await readConfigs();
    const active = await readActiveId();
    configs = list;
    activeId = active && list.some((item) => item.id === active) ? active : (list[0]?.id ?? null);
    loaded = true;
    emit();
  })();
  return loadPromise;
}

/** 新增一份配置（并设为当前） */
export async function addConfig(config: SyncConfig): Promise<void> {
  configs = [...configs, config];
  await writeConfigs(configs);
  await writeActiveId(config.id);
  activeId = config.id;
  emit();
}

/** 改一份配置 */
export async function updateConfig(config: SyncConfig): Promise<void> {
  configs = configs.map((item) => (item.id === config.id ? config : item));
  await writeConfigs(configs);
  emit();
}

/** 删一份配置（连密钥一起删） */
export async function removeConfig(id: string): Promise<void> {
  configs = configs.filter((item) => item.id !== id);
  await writeConfigs(configs);
  await clearConfigSecrets(id);
  forgetAccessToken(id);
  if (activeId === id) {
    activeId = configs[0]?.id ?? null;
    await writeActiveId(activeId);
  }
  emit();
}

/** 切换当前配置 */
export async function setActiveConfig(id: string): Promise<void> {
  await writeActiveId(id);
  activeId = id;
  emit();
}

/** 记一次「同步成功」 */
export async function markConfigSynced(id: string, at: number): Promise<void> {
  configs = configs.map((item) => (item.id === id ? { ...item, lastSyncAt: at } : item));
  await writeConfigs(configs);
  emit();
}
