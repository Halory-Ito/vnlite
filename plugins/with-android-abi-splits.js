/**
 * Expo config plugin：让 Android 按 CPU 架构分包（ABI splits）。
 *
 * ## 为什么需要它
 *
 * EAS Build 的 `eas.json` schema **没有** `splits` 选项
 * （`"build.preview.android.splits" is not allowed`，实测 eas-cli 24.8.0），
 * 所以「按架构产出多个 APK」只能在 Gradle 层做。
 *
 * 本项目是**托管工作流**（`/android` 不入库，EAS 构建时现 prebuild），
 * 于是用 config plugin 在 prebuild 之后往生成的 `app/build.gradle` 里
 * 插一段 `splits`——比提交一整个原生目录轻得多。
 *
 * ## 默认产物
 *
 * ```groovy
 * splits {
 *     abi {
 *         enable true
 *         reset()
 *         include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
 *         universalApk true
 *     }
 * }
 * ```
 *
 * 4 个架构包 + 1 个通用包，共 5 个 APK。`universalApk true` 是刻意保留的 ——
 * 分发给别人时对方未必知道自己手机是什么架构，通用包能兜底。
 *
 * ## 只要单个架构（开发用）
 *
 * 设环境变量 `VNLITE_ANDROID_ABIS`（逗号分隔）即可只打指定架构，且不再出通用包，例如：
 *
 * ```bash
 * VNLITE_ANDROID_ABIS=arm64-v8a eas build -p android --profile preview-arm64
 * ```
 *
 * `eas.json` 里已有现成档位 `preview-arm64`，帮你把这个变量设好。
 *
 * Gradle 会自动给每个分包分配互不相同的 versionCode（按 ABI 偏移），
 * 不会跟 Play Store 的上传号冲突。
 */

const { withAppBuildGradle } = require("expo/config-plugins");

/** 四种主流架构：32 位旧机 / 64 位主流 / 两种模拟器 */
const DEFAULT_ABIS = ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"];

/**
 * 解析要包含的架构。
 *
 * - 没设 `VNLITE_ANDROID_ABIS`：默认全架构 + 通用包
 * - 设了：只取其中合法的架构，且**不再出通用包**（单架构开发包，体积最小）
 */
function resolveAbis() {
  const raw = process.env.VNLITE_ANDROID_ABIS;
  if (!raw) return { abis: DEFAULT_ABIS, universal: true };

  const requested = raw
    .split(",")
    .map((abi) => abi.trim())
    .filter((abi) => DEFAULT_ABIS.includes(abi));
  if (requested.length === 0) return { abis: DEFAULT_ABIS, universal: true };
  return { abis: requested, universal: false };
}

/**
 * Expo 生成的 `app/build.gradle` 里，android 块一定以这两行开头：
 * `android {` 紧跟 `ndkVersion rootProject.ext.ndkVersion`。
 * 用它当锚点，别去碰文件里其它可能出现的 `android {`。
 */
const ANDROID_BLOCK = /android \{\n(\s+)ndkVersion/;

module.exports = function withAndroidAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "with-android-abi-splits: 只支持 groovy 版的 app/build.gradle（KTS 不在支持范围）"
      );
    }

    const contents = cfg.modResults.contents;

    // 幂等：prebuild 有时会跑两遍，已经插过就别再插
    if (contents.includes("splits {")) return cfg;

    if (!ANDROID_BLOCK.test(contents)) {
      throw new Error(
        "with-android-abi-splits: 没在 app/build.gradle 里找到 android 块，模板结构变了？"
      );
    }

    const { abis, universal } = resolveAbis();
    const snippet = `    splits {
        abi {
            enable true
            reset()
            include ${abis.map((abi) => `"${abi}"`).join(", ")}
            universalApk ${universal}
        }
    }
`;

    cfg.modResults.contents = contents.replace(ANDROID_BLOCK, `android {\n${snippet}$1ndkVersion`);

    return cfg;
  });
};
