/**
 * 拉起系统安装器安装 APK（Android 专有）。
 *
 * ## 怎么装
 *
 * APK 在应用沙盒里，系统安装器读不到 —— 要先换成 `content://` URI
 * （`expo-file-system` 的 FileProvider 提供），再用
 * `ACTION_VIEW` + `application/vnd.android.package-archive` 交给系统。
 *
 * ## 「未知来源」授权
 *
 * Android 8 起，装 APK 的应用必须自己声明 `REQUEST_INSTALL_PACKAGES`
 * 权限，**并且**用户在系统里给本应用开了「允许安装未知应用」，
 * 否则安装器只会弹一句「不允许从此来源安装应用」。
 *
 * 所以安装失败时把用户送到系统的「安装未知应用」设置页
 * （`MANAGE_UNKNOWN_APP_SOURCES`），让他授权完再回来重试。
 * 权限由 `plugins/with-android-install-packages.js` 写进 AndroidManifest。
 */

import Constants from "expo-constants";
import * as IntentLauncher from "expo-intent-launcher";
import type { File } from "expo-file-system";
import { Platform } from "react-native";

/** APK 的 MIME */
const APK_MIME = "application/vnd.android.package-archive";

/** `FLAG_GRANT_READ_URI_PERMISSION`：让安装器能读这个 content:// */
const FLAG_GRANT_READ = 1;

/** 本应用的包名（用于「允许安装未知应用」设置页） */
export function appPackageName(): string | null {
  return Constants.expoConfig?.android?.package ?? null;
}

/**
 * 打开系统安装器安装 APK。
 *
 * @param file 已下载好的安装包
 */
export async function installApk(file: File): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("只有 Android 支持直接安装 APK");
  }
  const contentUri = file.contentUri;
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    flags: FLAG_GRANT_READ,
    type: APK_MIME,
    data: contentUri,
  });
}

/** 打开系统的「允许安装未知应用」设置页（本应用那一项） */
export async function openUnknownSourcesSettings(): Promise<void> {
  const packageName = appPackageName();
  if (!packageName) throw new Error("读不到应用包名");
  await IntentLauncher.startActivityAsync("android.settings.MANAGE_UNKNOWN_APP_SOURCES", {
    data: `package:${packageName}`,
  });
}
