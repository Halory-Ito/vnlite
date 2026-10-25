/**
 * Expo config plugin：给 AndroidManifest 加「安装未知应用」权限。
 *
 * ## 为什么需要
 *
 * Android 8（API 26）起，装 APK 的应用自己必须声明
 * `android.permission.REQUEST_INSTALL_PACKAGES`，
 * **并且**用户在系统设置里给本应用开了「允许安装未知应用」，
 * 否则系统安装器只会弹一句「不允许从此来源安装应用」。
 *
 * 「检查更新」下载完的安装包要交给系统安装器装，走的就是这条路，
 * 所以这个权限是这条功能的**前提**，不是可选项。
 *
 * 本应用只在 GitHub Releases 分发（不进应用商店），不涉及商店对
 * `REQUEST_INSTALL_PACKAGES` 的审核限制。
 *
 * ## 用法
 *
 * 在 `app.json` 的 `plugins` 里加一行 `"./plugins/with-android-install-packages"`。
 */

const { withAndroidManifest } = require("expo/config-plugins");

/** 「允许安装未知应用」权限 */
const PERMISSION = "android.permission.REQUEST_INSTALL_PACKAGES";

module.exports = function withAndroidInstallPackages(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];

    // 幂等：prebuild 可能跑两遍，别重复声明
    const already = permissions.some((item) => item.$?.["android:name"] === PERMISSION);
    if (!already) {
      permissions.push({ $: { "android:name": PERMISSION } });
      manifest["uses-permission"] = permissions;
    }

    return cfg;
  });
};
