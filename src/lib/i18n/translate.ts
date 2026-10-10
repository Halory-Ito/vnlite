/**
 * i18n 运行时（**纯 JS，可被 bun 冒烟直接 import**）。
 *
 * - `zh` 是源语言目录，`en` 用 `Catalog` 类型卡住结构
 * - `i18n-js` 负责插值与回退；本模块只维护「当前语言」这一份状态
 * - 设备语言由 native 侧（`./index.ts`）注入，这里不 import 任何原生模块
 *
 * 组件请用 `hooks/use-translation`（订阅语言偏好、切换后自动重渲染）；
 * 纯函数 / 工具函数用这里的全局 `t`（语言切换时由 `./index.ts` 的订阅同步）。
 */

import { I18n } from "i18n-js";

import { en } from "./catalogs/en";
import { zh } from "./catalogs/zh";

/** 界面语言偏好值（`system` 跟随设备） */
export type Language = "system" | "zh" | "en";

/** 实际生效的语言 */
export type Locale = "zh" | "en";

type Join<P extends string, K extends string> = P extends "" ? K : `${P}.${K}`;

/** 把嵌套目录拍平成 `a.b.c` 的联合类型，`t` 的键由此获得补全与拼写检查 */
type TranslationKeyOf<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? Join<P, K> : TranslationKeyOf<T[K], Join<P, K>>;
}[keyof T & string];

export type TranslationKey = TranslationKeyOf<typeof zh>;

export type TranslationParams = Record<string, string | number>;

const i18n = new I18n({ zh, en });
i18n.defaultLocale = "zh";
i18n.enableFallback = true;

/** 设备语言（`./index.ts` 启动时注入；默认 zh，bun 冒烟不受影响） */
let deviceLocale: Locale = "zh";
export function setDeviceLocale(locale: Locale): void {
  deviceLocale = locale;
}

let currentLocale: Locale = "zh";

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  i18n.locale = locale;
}

setLocale("zh");

/** 语言偏好 + 设备语言 → 实际生效的语言 */
export function resolveLocale(language: Language): Locale {
  if (language === "zh" || language === "en") return language;
  return deviceLocale;
}

/** 生成绑定到指定语言的翻译函数（`useTranslation` 用，避免渲染期读模块状态） */
export function createTranslator(locale: Locale) {
  return (key: TranslationKey, params?: TranslationParams): string =>
    i18n.t(key, { ...params, locale });
}

/**
 * 全局翻译。给纯函数 / 工具函数（如 `utils/format`）用。
 *
 * ⚠️ 组件里用它不会自动响应「语言切换」—— 需要重渲染的组件请用 `useTranslation`。
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return i18n.t(key, { ...params, locale: currentLocale });
}
