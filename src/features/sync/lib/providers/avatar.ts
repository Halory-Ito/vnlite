/**
 * 头像上传的分发（**原生**）。
 *
 * 头像是二进制，走 `expo-file-system` 的原生 PUT（不经 JS 线程）。
 * 这里按供应商分流 —— 所以放在 `providers/avatar.ts` 而不是某个供应商目录里，
 * 免得纯 fetch 的模块（bun 冒烟要 import）被原生模块污染。
 */

import type { File } from "expo-file-system";

import { putAvatar as putOneDriveAvatar } from "@/features/sync/lib/providers/onedrive/file";
import type { ProviderContext } from "./types";
import { putAvatar as putWebDavAvatar } from "@/features/sync/lib/providers/webdav/file";
import { webdavConfigOf } from "@/features/sync/lib/providers/webdav/provider";

/** 上传本地头像到对应的网盘 */
export async function putProviderAvatar(ctx: ProviderContext, file: File): Promise<void> {
  if (ctx.provider === "onedrive") {
    await putOneDriveAvatar(ctx, file);
    return;
  }
  if (ctx.provider === "webdav") {
    await putWebDavAvatar(await webdavConfigOf(ctx), file);
  }
}
