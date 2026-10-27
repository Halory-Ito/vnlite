/**
 * 备份同步的状态机：上传 / 下载 / 恢复（**与供应商无关**）。
 *
 * ## 下载为什么要分两步
 *
 * 下载回来的备份**不直接写进本地库** —— 先摆给用户看（有多少条历史、收藏…），
 * 用户确认了才恢复。恢复是**整体替换**，不确认就动本地数据太危险。
 *
 * ## 恢复后要失效的缓存
 *
 * 收藏 / 历史 / 游玩记录 / 攻略标记都是 React Query 托管的，
 * 直接改库不会自动刷新列表 —— 恢复完手动失效一遍。
 *
 * ## 多份配置
 *
 * 每份配置各传各的（互不干扰），所以状态里带着「正在同步哪一份」，
 * 卡片据此显示「同步中 / 出错」。
 */

import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useCallback, useState } from "react";

import { downloadAvatar, uploadAvatar } from "@/features/sync/lib/avatar-sync";
import { parseBackup, type BackupPayload } from "@/features/sync/lib/backup";
import { secretStoreFor } from "@/features/sync/lib/configs/secrets";
import type { SyncConfig } from "@/features/sync/lib/configs/types";
import { createBackupPayload, restoreBackupPayload } from "@/features/sync/lib/package";
import { getProvider } from "@/features/sync/lib/providers/registry";
import type { ProviderContext } from "@/features/sync/lib/providers/types";
import { useTranslation } from "@/hooks/use-translation";
import { queryKeys } from "@/lib/query/keys";

export type SyncPhase =
  | "idle"
  /** 正在打包本地数据 */
  | "packing"
  /** 正在上传 */
  | "uploading"
  /** 正在下载 */
  | "downloading"
  /** 正在写回本地 */
  | "restoring"
  /** 出错了（`error` 里有话） */
  | "error";

/** 下载完、等着用户确认恢复的备份 */
export interface PendingRestore {
  payload: BackupPayload;
  /** 这份备份是从哪份配置下来的 */
  config: SyncConfig;
}

export interface UseSyncBackup {
  phase: SyncPhase;
  /** 正在处理哪份配置 */
  busyConfigId: string | null;
  /** 出错的是哪份配置 */
  errorConfigId: string | null;
  /** 错误文案 */
  error: string | null;
  /** 下载完、等待用户确认恢复的备份 */
  pending: PendingRestore | null;
  /** 上传本地数据；成功返回 true */
  upload: (config: SyncConfig) => Promise<boolean>;
  /** 从服务器下载（不写本地，先等确认） */
  download: (config: SyncConfig) => Promise<boolean>;
  /** 确认恢复 */
  restore: () => Promise<boolean>;
  /** 放弃这次恢复 */
  cancelRestore: () => void;
  /** 清掉错误提示 */
  clearError: () => void;
}

/** 配置 → 供应商调用上下文 */
export function contextOf(config: SyncConfig): ProviderContext {
  return {
    provider: config.provider,
    configId: config.id,
    options: config.options,
    secrets: secretStoreFor(config.id),
  };
}

export function useSyncBackup(): UseSyncBackup {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busyConfigId, setBusyConfigId] = useState<string | null>(null);
  const [errorConfigId, setErrorConfigId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);

  const fail = useCallback(
    (configId: string, err: unknown): void => {
      setPhase("error");
      setErrorConfigId(configId);
      setError(err instanceof Error && err.message ? err.message : t("common.unknownError"));
    },
    [t]
  );

  const upload = useCallback(
    async (config: SyncConfig): Promise<boolean> => {
      const provider = getProvider(config.provider);
      if (!provider) {
        fail(config.id, new Error(t("sync.providerNotReady")));
        return false;
      }
      setError(null);
      setErrorConfigId(null);
      setBusyConfigId(config.id);
      setPhase("packing");
      const ctx = contextOf(config);
      try {
        const payload = await createBackupPayload();
        setPhase("uploading");
        await provider.putBackup(ctx, JSON.stringify(payload));
        // 头像跟备份一起上去；单独失败不影响这次备份的结果
        await uploadAvatar(ctx);
        setPhase("idle");
        toast.show(t("sync.uploaded"));
        return true;
      } catch (err) {
        fail(config.id, err);
        return false;
      } finally {
        setBusyConfigId(null);
      }
    },
    [fail, t, toast]
  );

  const download = useCallback(
    async (config: SyncConfig): Promise<boolean> => {
      const provider = getProvider(config.provider);
      if (!provider) {
        fail(config.id, new Error(t("sync.providerNotReady")));
        return false;
      }
      setError(null);
      setErrorConfigId(null);
      setBusyConfigId(config.id);
      setPhase("downloading");
      try {
        const result = await provider.getBackup(contextOf(config));
        if (!result) {
          setPhase("idle");
          toast.show(t("sync.remoteMissing"));
          return true;
        }

        // 服务器上的文件不是 JSON（放错文件了 / 服务器返回了错误页）
        let raw: unknown;
        try {
          raw = JSON.parse(result.body) as unknown;
        } catch {
          fail(config.id, new Error(t("sync.invalidBackup")));
          return false;
        }
        const payload = parseBackup(raw);
        if (!payload) {
          fail(config.id, new Error(t("sync.invalidBackup")));
          return false;
        }
        setPending({ payload, config });
        setPhase("idle");
        return true;
      } catch (err) {
        fail(config.id, err);
        return false;
      } finally {
        setBusyConfigId(null);
      }
    },
    [fail, t, toast]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    if (!pending) return false;
    setError(null);
    setErrorConfigId(null);
    setBusyConfigId(pending.config.id);
    setPhase("restoring");
    try {
      await restoreBackupPayload(pending.payload);
      // 换机场景：头像文件不在备份 JSON 里，得单独从服务器拉一次
      await downloadAvatar(contextOf(pending.config));
      setPending(null);
      setPhase("idle");
      // 本地库被换掉了 —— 列表类的查询缓存全部失效
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.favorite.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.playRecords.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.walkthrough.all }),
      ]);
      toast.show(t("sync.restored"));
      return true;
    } catch (err) {
      fail(pending.config.id, err);
      return false;
    } finally {
      setBusyConfigId(null);
    }
  }, [fail, pending, queryClient, t, toast]);

  const cancelRestore = useCallback((): void => {
    setPending(null);
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
    setErrorConfigId(null);
    setPhase("idle");
  }, []);

  return {
    phase,
    busyConfigId,
    errorConfigId,
    error,
    pending,
    upload,
    download,
    restore,
    cancelRestore,
    clearError,
  };
}
