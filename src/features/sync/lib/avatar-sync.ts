/**
 * 头像的云端同步。
 *
 * 头像跟着**备份**走：上传备份时顺带传头像，恢复备份时顺带拉头像。
 * 服务器上没有头像文件时保留本地的（不是错误）。
 *
 * ## 为什么失败只吞掉
 *
 * 头像只是锦上添花：服务器目录只读、空间满、头像太大都可能只让头像这一项失败。
 * 备份本身已经传成功了，这时候把整次同步判成失败、弹一个错误，反而误导用户。
 * 真正的备份错误仍由 `use-sync-backup` 统一报。
 */

import { avatarUploadFile, writeAvatarBytes } from "@/features/profile/lib/avatar";

import { putProviderAvatar } from "@/features/sync/lib/providers/avatar";
import { getProvider } from "@/features/sync/lib/providers/registry";
import type { ProviderContext } from "@/features/sync/lib/providers/types";

/** 上传本地头像（没有头像就跳过） */
export async function uploadAvatar(ctx: ProviderContext): Promise<void> {
  const file = avatarUploadFile();
  if (!file) return;
  try {
    await putProviderAvatar(ctx, file);
  } catch (error) {
    console.warn("[sync] 头像上传失败", error);
  }
}

/** 拉取云端头像并覆盖本地（服务器没有就保留本地） */
export async function downloadAvatar(ctx: ProviderContext): Promise<void> {
  const provider = getProvider(ctx.provider);
  if (!provider) return;
  try {
    const bytes = await provider.getAvatar(ctx);
    if (bytes) await writeAvatarBytes(bytes);
  } catch (error) {
    console.warn("[sync] 头像下载失败", error);
  }
}
