/**
 * i18n 运行时初始化（**native 环境专用**，bun 冒烟不 import 本文件）。
 *
 * 职责：
 *   1. 读取设备语言（expo-localization）
 *   2. 读取语言偏好，解析出实际生效的语言
 *   3. 订阅偏好变化 —— 用户切换语言后同步全局 `t`（组件由 `useTranslation` 重渲染）
 *
 * 在 `app/_layout.tsx` 模块加载时调用，保证**首帧**就用对语言。
 */

import { getLocales } from "expo-localization";

import { getPreference, loadPreferences, subscribePreferences } from "@/lib/storage/preferences";

import { resolveLocale, setDeviceLocale, setLocale } from "./translate";

/** 设备语言 → 支持的 Locale（其它语言回退到英语；读不到 / 抛错时回退中文） */
function readDeviceLocale(): "zh" | "en" {
  try {
    const code = getLocales()[0]?.languageCode ?? "";
    return code.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "zh";
  }
}

/** 语言偏好 + 设备语言 → 全局 locale */
function applyLocale(): void {
  setLocale(resolveLocale(getPreference("language")));
}

/**
 * 启动 i18n。返回取消订阅函数（App 生命周期内不需要，留作测试 / 热重载用）。
 */
export function initI18n(): () => void {
  setDeviceLocale(readDeviceLocale());

  applyLocale();
  // 偏好是异步水合的：读完再同步一次（用户在设备语言非中文时会看到一次切换）
  void loadPreferences().then(applyLocale);

  return subscribePreferences(applyLocale);
}
