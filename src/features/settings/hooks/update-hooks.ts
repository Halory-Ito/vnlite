/**
 * 「检查更新」的状态机：查版本 → 选安装包 → 选下载源 → 下载 → 交给用户决定装不装。
 *
 * ## 下载源怎么定
 *
 * 1. 先按出口 IP 判归属地（`update-region`）
 * 2. **国内** → 测速所有 GitHub 加速代理，用**延迟最低**的那个下载
 *    （代理全挂时回退直连；直连再不行就换下一个代理）
 * 3. 海外 → 直接连 GitHub，失败了再回退到代理
 *
 * ## 为什么不自动装
 *
 * 下载完只把安装包放在缓存里，**装不装由用户决定**（系统安装器要用户点确认，
 * 而且首次还要授予「允许安装未知应用」）。
 */

import * as Device from "expo-device";
import { useToast } from "heroui-native";
import type { File } from "expo-file-system";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

import { useTranslation } from "@/hooks/use-translation";

import { isNewerVersion } from "@/features/settings/lib/update-check";
import { pickApkAsset } from "@/features/settings/lib/update-asset";
import {
  fetchLatestRelease,
  type ReleaseAsset,
  type UpdateInfo,
} from "@/features/settings/lib/update-client";
import {
  downloadApk,
  removeApk,
  removeApkByVersion,
  type DownloadProgress,
} from "@/features/settings/lib/update-download";
import { installApk, openUnknownSourcesSettings } from "@/features/settings/lib/update-install";
import { mirrorUrl, probeMirrors, sortByLatency } from "@/features/settings/lib/update-mirror";
import { detectRegion } from "@/features/settings/lib/update-region";

export type UpdatePhase =
  /** 还没查过 */
  | "idle"
  /** 正在查版本 */
  | "checking"
  /** 已是最新 */
  | "latest"
  /** 检查失败 */
  | "error"
  /** 有新版本，但拿不到安装包（iOS / Release 没附件） */
  | "available"
  /** 正在选包 + 测速 */
  | "preparing"
  /** 下载中 */
  | "downloading"
  /** 下载完成，等用户决定装不装 */
  | "ready"
  /** 下载失败 */
  | "failed";

export interface UpdateState {
  phase: UpdatePhase;
  /** 新版本信息（available / preparing / downloading / ready / failed） */
  info: UpdateInfo | null;
  /** 选中的安装包 */
  asset: ReleaseAsset | null;
  /** 下载进度 */
  progress: DownloadProgress;
  /** 下载完成的安装包 */
  file: File | null;
  /** 失败原因（展示用） */
  error: string | null;
}

const EMPTY_PROGRESS: DownloadProgress = { received: 0, total: 0, ratio: 0 };

const INITIAL_STATE: UpdateState = {
  phase: "idle",
  info: null,
  asset: null,
  progress: EMPTY_PROGRESS,
  file: null,
  error: null,
};

/** 下载地址候选：按优先级排，逐个试 */
async function buildCandidates(asset: ReleaseAsset): Promise<string[]> {
  const direct = asset.url;
  const region = await detectRegion();

  // 测速：按延迟从低到高排，第一个就是最快的代理
  const probes = sortByLatency(await probeMirrors(asset.url));
  const mirrorUrls = probes
    .filter((probe) => probe.latency !== null)
    .map((probe) => mirrorUrl(probe.mirror, asset.url));

  // 国内：代理优先（直连最后兜底）；海外 / 未知：直连优先，失败再退到代理
  return region === "cn" ? [...mirrorUrls, direct] : [direct, ...mirrorUrls];
}

export interface UseUpdateCheck {
  state: UpdateState;
  /** 检查更新（发现新版本会自动开始下载） */
  check: () => Promise<void>;
  /** 打开系统安装器 */
  install: () => Promise<void>;
  /** 取消下载 */
  cancel: () => void;
  /** 重新下载（失败后重试） */
  retry: () => Promise<void>;
  /** 收起更新卡片 */
  dismiss: () => void;
}

export function useUpdateCheck(currentVersion: string): UseUpdateCheck {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [state, setState] = useState<UpdateState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((next: Partial<UpdateState>): void => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  /** 下载：按候选地址逐个试，第一个成功就用它 */
  const runDownload = useCallback(
    async (info: UpdateInfo, asset: ReleaseAsset): Promise<void> => {
      const controller = new AbortController();
      abortRef.current = controller;
      patch({ phase: "preparing", info, asset, progress: EMPTY_PROGRESS, error: null });

      try {
        const candidates = await buildCandidates(asset);
        if (controller.signal.aborted) return;

        patch({ phase: "downloading" });
        let lastError: unknown = null;
        for (const url of candidates) {
          if (controller.signal.aborted) return;
          try {
            const file = await downloadApk(
              url,
              info.version,
              (progress) => {
                patch({ progress });
              },
              controller.signal
            );
            patch({ phase: "ready", file, progress: { ...progressOf(file), ratio: 1 } });
            return;
          } catch (error) {
            if (controller.signal.aborted) return;
            lastError = error;
          }
        }
        patch({ phase: "failed", error: describeError(lastError, t("common.unknownError")) });
      } catch (error) {
        if (controller.signal.aborted) return;
        patch({ phase: "failed", error: describeError(error, t("common.unknownError")) });
      } finally {
        abortRef.current = null;
      }
    },
    [patch, t]
  );

  const check = useCallback(async (): Promise<void> => {
    if (
      state.phase === "checking" ||
      state.phase === "preparing" ||
      state.phase === "downloading"
    ) {
      return;
    }
    patch({ phase: "checking", error: null });
    try {
      const latest = await fetchLatestRelease();
      if (!latest || !isNewerVersion(latest.version, currentVersion)) {
        patch({ phase: "latest" });
        toast.show(t("update.latestToast"));
        return;
      }

      // 非 Android 没有 APK 可下，只能去发布页
      if (Platform.OS !== "android") {
        patch({ phase: "available", info: latest });
        return;
      }

      const abis = Device.supportedCpuArchitectures ?? [];
      const asset = pickApkAsset(latest.assets, abis);
      if (!asset) {
        patch({ phase: "available", info: latest });
        return;
      }
      await runDownload(latest, asset);
    } catch {
      patch({ phase: "error" });
      toast.show(t("update.failedToast"));
    }
  }, [currentVersion, patch, runDownload, state.phase, t, toast]);

  const retry = useCallback(async (): Promise<void> => {
    if (!state.info) {
      await check();
      return;
    }
    const abis = Device.supportedCpuArchitectures ?? [];
    const asset = state.asset ?? pickApkAsset(state.info.assets, abis);
    if (!asset) {
      patch({ phase: "available", info: state.info });
      return;
    }
    await runDownload(state.info, asset);
  }, [check, patch, runDownload, state.asset, state.info]);

  const install = useCallback(async (): Promise<void> => {
    if (!state.file) return;
    try {
      await installApk(state.file);
    } catch {
      // 拉不起安装器，多半是「允许安装未知应用」没开
      toast.show(t("update.installFailed"));
      try {
        await openUnknownSourcesSettings();
      } catch {
        // 连设置页都打不开就算了
      }
    }
  }, [state.file, t, toast]);

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    removeApk(state.file);
    removeApkByVersion(state.info?.version);
    patch({ phase: "idle", file: null, progress: EMPTY_PROGRESS, error: null });
  }, [patch, state.file, state.info]);

  const dismiss = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    removeApk(state.file);
    removeApkByVersion(state.info?.version);
    patch({
      phase: "idle",
      info: null,
      asset: null,
      file: null,
      progress: EMPTY_PROGRESS,
      error: null,
    });
  }, [patch, state.file, state.info]);

  return { state, check, install, cancel, retry, dismiss };
}

/** 错误 → 人话 */
function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** 已下载文件的大小（拿不到就 0） */
function progressOf(file: File): DownloadProgress {
  try {
    const size = file.size ?? 0;
    return { received: size, total: size, ratio: 1 };
  } catch {
    return EMPTY_PROGRESS;
  }
}
