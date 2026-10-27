/**
 * OneDrive 上传（**原生**，目前只有头像）。
 *
 * 与 `client.ts` 分开的原因一样：这里是 `expo-file-system` 的原生 PUT
 * （二进制不经 JS 线程），冒烟脚本不能 import。
 */

import { UploadType, type File } from "expo-file-system";

import { t } from "@/lib/i18n/translate";

import type { ProviderContext } from "@/features/sync/lib/providers/types";
import { accessToken, avatarUploadUrl } from "./client";

/** 上传头像 */
export async function putAvatar(ctx: ProviderContext, file: File): Promise<void> {
  const token = await accessToken(ctx);
  const result = await file.upload(avatarUploadUrl(), {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "image/jpeg",
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(t("sync.requestFailed", { status: String(result.status) }));
  }
}
