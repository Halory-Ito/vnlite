/**
 * 选安装包：Release 附件里挑**本机架构**的那一个。
 *
 * EAS 按 ABI 分包（见 `plugins/with-android-abi-splits.js`），一个 Release 里有：
 *   `app-arm64-v8a-release.apk` / `app-armeabi-v7a-release.apk` /
 *   `app-x86-release.apk` / `app-x86_64-release.apk` / `app-universal-release.apk`
 *
 * 通用包 124 MB，arm64 只有 53 MB —— 挑对了能省一半流量，
 * 所以这里按设备支持的 ABI 顺序（`Build.SUPPORTED_ABIS`，首选在前）依次匹配。
 *
 * ## 为什么是「解析后全等」而不是「包含」
 *
 * `x86` 是 `x86_64` 的前缀，`arm64` 是 `arm64-v8a` 的前缀 ——
 * 用 `includes` 会把 64 位设备配到 32 位包上（装不上，白下 50 MB）。
 * 所以先把文件名里的架构标识**解析出来**，再跟设备 ABI **全等**比较。
 *
 * 纯函数（不碰原生模块），冒烟可直接测。
 */

import type { ReleaseAsset } from "./update-client";

/** 通用包（兜底）：任何架构都能装，只是大 */
const UNIVERSAL_ABI = "universal";

/** 安装包文件名（带版本号，避免新旧版本互相覆盖） */
export function apkFileName(version: string): string {
  const safe = version.replace(/[^\w.-]+/g, "_");
  return `vnlite-update-${safe}.apk`;
}

/** APK 附件（按文件名后缀判断，Release 里可能混着校验文件、截图） */
export function isApkAsset(asset: ReleaseAsset): boolean {
  return asset.name.toLowerCase().endsWith(".apk");
}

/**
 * 从附件名里解析出架构标识。
 *
 * `app-arm64-v8a-release.apk` → `arm64-v8a`
 * `app-x86_64-release.apk`    → `x86_64`
 * `app-universal-release.apk` → `universal`
 *
 * 规则：去掉结尾的 `-release.apk`（有就去），再取**第一个短横线之后**的部分。
 * 前面是什么前缀不重要（`app-` / `vnlite-` 都行），
 * 后面挂了什么后缀也不影响（`app-arm64-v8a-release.apk` 里的 `-release` 已被剥掉）。
 */
export function parseAssetAbi(name: string): string | null {
  const withoutSuffix = name.replace(/-release\.apk$/i, "");
  const dash = withoutSuffix.indexOf("-");
  const abi = (dash >= 0 ? withoutSuffix.slice(dash + 1) : withoutSuffix).trim().toLowerCase();
  return abi || null;
}

/**
 * 选安装包。
 *
 * @param assets Release 附件
 * @param abis 设备支持的架构（首选在前，如 `["arm64-v8a", "armeabi-v7a"]`）
 * @returns 命中的附件；没有可用 APK 时返回 null
 */
export function pickApkAsset(assets: ReleaseAsset[], abis: string[]): ReleaseAsset | null {
  const apks = assets.filter(isApkAsset);
  if (apks.length === 0) return null;

  for (const abi of abis) {
    const target = abi.trim().toLowerCase();
    if (!target) continue;
    const hit = apks.find((asset) => parseAssetAbi(asset.name) === target);
    if (hit) return hit;
  }

  // 认不出架构 → 通用包兜底（一定能装，只是大）
  return apks.find((asset) => parseAssetAbi(asset.name) === UNIVERSAL_ABI) ?? null;
}
