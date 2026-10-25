/**
 * 备份同步的状态机：上传 / 下载 / 恢复。
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
 */

import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useCallback, useState } from "react";

import { useTranslation } from "@/hooks/use-translation";
import { queryKeys } from "@/lib/query/keys";

import { parseBackup, type BackupPayload } from "./backup";
import { downloadAvatar, uploadAvatar } from "./avatar-sync";
import { createBackupPayload, restoreBackupPayload } from "./package";
import { writeLastSyncAt } from "./server-config";
import { getBackup, putBackup, type RemoteFileInfo, type WebDavConfig } from "./webdav";

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

export interface UseSyncBackup {
  phase: SyncPhase;
  /** 错误文案 */
  error: string | null;
  /** 服务器上那个文件的信息（下载后 / 上传后更新） */
  remote: RemoteFileInfo | null;
  /** 下载完、等待用户确认恢复的备份 */
  pending: BackupPayload | null;
  /** 上传本地数据 */
  upload: (config: WebDavConfig) => Promise<void>;
  /** 从服务器下载（不写本地，先等确认） */
  download: (config: WebDavConfig) => Promise<void>;
  /** 确认恢复 */
  restore: () => Promise<void>;
  /** 放弃这次恢复 */
  cancelRestore: () => void;
  /** 清掉错误提示 */
  clearError: () => void;
}

export function useSyncBackup(): UseSyncBackup {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteFileInfo | null>(null);
  const [pending, setPending] = useState<BackupPayload | null>(null);
  /**
   * 下载时用的服务器配置。
   *
   * 恢复（`restore`）发生在用户点确认之后，那时表单可能已经被改过，
   * 所以不能读表单值 —— 记住「这份备份是从哪台服务器下来的」，恢复完顺手拉头像。
   */
  const [pendingConfig, setPendingConfig] = useState<WebDavConfig | null>(null);

  const fail = useCallback(
    (err: unknown): void => {
      setPhase("error");
      setError(err instanceof Error && err.message ? err.message : t("common.unknownError"));
    },
    [t]
  );

  const upload = useCallback(
    async (config: WebDavConfig): Promise<void> => {
      setError(null);
      setPhase("packing");
      try {
        const payload = await createBackupPayload();
        setPhase("uploading");
        const info = await putBackup(config, JSON.stringify(payload));
        setRemote(info);
        // 头像跟备份一起上去；单独失败不影响这次备份的结果
        await uploadAvatar(config);
        await writeLastSyncAt(Date.now());
        setPhase("idle");
        toast.show(t("sync.uploaded"));
      } catch (err) {
        fail(err);
      }
    },
    [fail, t, toast]
  );

  const download = useCallback(
    async (config: WebDavConfig): Promise<void> => {
      setError(null);
      setPhase("downloading");
      try {
        const result = await getBackup(config);
        if (!result) {
          setPhase("idle");
          setRemote(null);
          toast.show(t("sync.remoteMissing"));
          return;
        }
        setRemote(result.info);

        // 服务器上的文件不是 JSON（放错文件了 / 服务器返回了错误页）
        let raw: unknown;
        try {
          raw = JSON.parse(result.body) as unknown;
        } catch {
          setPhase("error");
          setError(t("sync.invalidBackup"));
          return;
        }
        const payload = parseBackup(raw);
        if (!payload) {
          setPhase("error");
          setError(t("sync.invalidBackup"));
          return;
        }
        setPending(payload);
        setPendingConfig(config);
        setPhase("idle");
      } catch (err) {
        fail(err);
      }
    },
    [fail, t, toast]
  );

  const restore = useCallback(async (): Promise<void> => {
    if (!pending) return;
    setError(null);
    setPhase("restoring");
    try {
      await restoreBackupPayload(pending);
      // 换机场景：头像文件不在备份 JSON 里，得单独从服务器拉一次
      if (pendingConfig) await downloadAvatar(pendingConfig);
      await writeLastSyncAt(Date.now());
      setPending(null);
      setPendingConfig(null);
      setPhase("idle");
      // 本地库被换掉了 —— 列表类的查询缓存全部失效
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.favorite.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.playRecords.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.walkthrough.all }),
      ]);
      toast.show(t("sync.restored"));
    } catch (err) {
      fail(err);
    }
  }, [fail, pending, pendingConfig, queryClient, t, toast]);

  const cancelRestore = useCallback((): void => {
    setPending(null);
    setPendingConfig(null);
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
    setPhase("idle");
  }, []);

  return {
    phase,
    error,
    remote,
    pending,
    upload,
    download,
    restore,
    cancelRestore,
    clearError,
  };
}
