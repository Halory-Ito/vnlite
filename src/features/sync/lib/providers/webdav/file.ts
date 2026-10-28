/**
 * WebDAV 上传（**原生**，目前只有头像）。
 *
 * 为什么单独一个文件：`client.ts` 是纯 `fetch`，冒烟脚本在 bun 里直接 import 它；
 * 这里要用 `expo-file-system` 的 `File.upload`（原生 PUT，文件不经 JS 线程），
 * import 进 `client.ts` 会让冒烟脚本加载原生模块而炸掉。
 */

import { UploadType, type File } from "expo-file-system";

import { AVATAR_FILE_NAME } from "@/features/sync/lib/backup";
import {
  buildAuthHeaders,
  ensureBackupDir,
  errorForStatus,
  remoteFileUrl,
  type WebDavConfig,
} from "./client";

/**
 * 上传头像。
 *
 * 请求头里显式带 `Content-Type`：有些 WebDAV 服务器按它决定落盘后缀，
 * 缺了会存成 `application/octet-stream`。
 */
export async function putAvatar(config: WebDavConfig, file: File): Promise<void> {
  // 原生上传不走 client 的 putBackup，目录要自己保证
  await ensureBackupDir(config);
  const result = await file.upload(remoteFileUrl(config, AVATAR_FILE_NAME), {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      ...buildAuthHeaders(config),
      "Content-Type": file.type || "image/jpeg",
    },
  });
  if (result.status < 200 || result.status >= 300) throw errorForStatus(result.status);
}
