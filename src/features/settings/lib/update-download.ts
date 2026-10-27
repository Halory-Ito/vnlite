/**
 * 下载安装包（APK）到本地缓存目录。
 *
 * 用 `expo-file-system` 的新 API（`File.createDownloadTask`）：
 *   - 原生下载，不经 JS 线程，50 MB 也不会卡 UI
 *   - 带进度回调（`bytesWritten` / `totalBytes`）
 *   - 支持 `AbortSignal` 取消
 *
 * 落在**缓存目录**：装完就没用了，系统空间紧张时会自己清掉。
 * 缓存目录也在 `expo-file-system` 的 FileProvider 授权范围内（`cache-path`），
 * 所以能直接拿到 `content://` URI 交给系统安装器。
 */

import { File, Paths } from "expo-file-system";

import { apkFileName } from "./update-asset";

export interface DownloadProgress {
  /** 已下载字节 */
  received: number;
  /** 总字节（服务端没给 Content-Length 时是 0） */
  total: number;
  /** 进度 0~1；总量未知时按 0 计（进度条走不确定态） */
  ratio: number;
}

/** 安装包落盘位置 */
export function apkTargetFile(version: string): File {
  return new File(Paths.cache, apkFileName(version));
}

/** 删掉安装包（取消 / 用户选择不装时调用） */
export function removeApk(file: File | null): void {
  if (!file) return;
  try {
    if (file.exists) file.delete();
  } catch {
    // 删不掉就算了，下一次下载会覆盖
  }
}

/**
 * 按版本删掉安装包。
 *
 * 取消下载时文件还没下完（`state.file` 还是 null），
 * 目标路径上却可能已经有个半截文件 —— 按版本号找到它删掉。
 */
export function removeApkByVersion(version: string | null | undefined): void {
  if (!version) return;
  removeApk(apkTargetFile(version));
}

/**
 * 下载安装包。
 *
 * @param url 直链或代理链接
 * @param version 版本号（决定文件名）
 * @param onProgress 进度回调
 * @param signal 外部取消
 * @returns 下载完成的文件
 */
export async function downloadApk(
  url: string,
  version: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<File> {
  const target = apkTargetFile(version);
  // 同名文件已存在时下载任务会报错，先清掉
  removeApk(target);

  const task = File.createDownloadTask(url, target, {
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress({
        received: bytesWritten,
        total: totalBytes > 0 ? totalBytes : 0,
        ratio: totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : 0,
      });
    },
  });

  const file = await task.downloadAsync();
  if (!file) throw new Error("下载被取消");
  return file;
}
