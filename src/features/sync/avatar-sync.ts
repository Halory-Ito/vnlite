/**
 * 头像的云端同步。
 *
 * 头像跟着**备份**走：上传备份时顺带 PUT 头像，恢复备份时顺带 GET 头像。
 * 服务器上没有头像文件时保留本地的（不是错误）。
 *
 * ## 为什么失败只吞掉
 *
 * 头像只是锦上添花：服务器目录只读、空间满、头像太大都可能只让头像这一项失败。
 * 备份本身已经传成功了，这时候把整次同步判成失败、弹一个错误，反而误导用户。
 * 真正的备份错误仍由 `use-sync-backup` 统一报。
 */

import { avatarUploadFile, writeAvatarBytes } from "@/features/profile/avatar";

import { getAvatar, type WebDavConfig } from "./webdav";
import { putAvatar } from "./webdav-file";

/** 上传本地头像（没有头像就跳过） */
export async function uploadAvatar(config: WebDavConfig): Promise<void> {
  const file = avatarUploadFile();
  if (!file) return;
  try {
    await putAvatar(config, file);
  } catch (error) {
    console.warn("[sync] 头像上传失败", error);
  }
}

/** 拉取云端头像并覆盖本地（服务器没有就保留本地） */
export async function downloadAvatar(config: WebDavConfig): Promise<void> {
  try {
    const bytes = await getAvatar(config);
    if (bytes) await writeAvatarBytes(bytes);
  } catch (error) {
    console.warn("[sync] 头像下载失败", error);
  }
}
