/**
 * 同步配置的管理（多份配置的增删改查 + 当前配置）。
 *
 * 状态放在 `configs/store`（模块级），这里只是 React 的绑定 ——
 * 「同步」页与「新建配置」页是两个路由，要看到同一份列表。
 */

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  addConfig,
  getActiveId,
  getConfigs,
  loadConfigs,
  markConfigSynced,
  removeConfig,
  setActiveConfig,
  subscribeConfigs,
  updateConfig,
} from "@/features/sync/lib/configs/store";
import type { SyncConfig } from "@/features/sync/lib/configs/types";

export interface UseSyncConfigs {
  /** 初次读取中 */
  loading: boolean;
  /** 全部配置 */
  configs: SyncConfig[];
  /** 当前使用的配置 id */
  activeId: string | null;
  /** 新增一份配置 */
  add: (config: SyncConfig) => Promise<void>;
  /** 改一份配置 */
  update: (config: SyncConfig) => Promise<void>;
  /** 删一份配置（连密钥一起删） */
  remove: (id: string) => Promise<void>;
  /** 切换当前配置 */
  setActive: (id: string) => Promise<void>;
  /** 记一次「同步成功」 */
  markSynced: (id: string, at: number) => Promise<void>;
}

export function useSyncConfigs(): UseSyncConfigs {
  const configs = useSyncExternalStore(subscribeConfigs, getConfigs, getConfigs);
  const activeId = useSyncExternalStore(subscribeConfigs, getActiveId, getActiveId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadConfigs().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    configs,
    activeId,
    add: addConfig,
    update: updateConfig,
    remove: removeConfig,
    setActive: setActiveConfig,
    markSynced: markConfigSynced,
  };
}
