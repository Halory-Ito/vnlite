/**
 * 翻译 hook。
 *
 * `translate.ts` 是模块级状态（React Compiler 不喜欢的写法），
 * 这里把它包装成「随语言偏好变化而重渲染」的纯值：
 *   - 用 `usePreferences()` 订阅 `language`（`useSyncExternalStore`）
 *   - 用 `useMemo` 生成绑定当前语言的 `t`
 *
 * 组件能用这个 hook 就用它；纯函数 / 工具函数里的全局 `t` 由 `initI18n` 同步。
 */

import { useMemo } from "react";

import {
  createTranslator,
  resolveLocale,
  type Locale,
  type TranslationKey,
  type TranslationParams,
} from "@/lib/i18n/translate";

import { usePreferences } from "./use-preferences";

export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

/** 返回当前语言的 `t` 与生效的 `locale` */
export function useTranslation(): { t: Translator; locale: Locale } {
  const language = usePreferences().language;
  const locale = resolveLocale(language);
  const t = useMemo(() => createTranslator(locale), [locale]);
  return { t, locale };
}

/** 只要 `t` 的简写 */
export function useT(): Translator {
  return useTranslation().t;
}
