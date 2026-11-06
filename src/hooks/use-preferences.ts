/**
 * 应用偏好的 React 绑定。
 *
 * `preferences.ts` 是「模块级快照 + 订阅」模式，这里用 `useSyncExternalStore`
 * 接到 React 树上。NSFW 档位会影响所有图片渲染，所以必须全局响应式。
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  DEFAULT_PREFERENCES,
  getPreferences,
  getPreference,
  loadPreferences,
  subscribePreferences,
  subscribePreference,
  type NsfwMode,
  type Preferences,
} from "@/lib/storage/preferences";

export function usePreferences(): Preferences {
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    () => DEFAULT_PREFERENCES
  );

  // 首次挂载时从 AsyncStorage 水合一次
  useEffect(() => {
    void loadPreferences();
  }, []);

  return preferences;
}

/** 字段快照保持原引用；无关偏好变化不触发组件更新。 */
export function usePreference<K extends keyof Preferences>(key: K): Preferences[K] {
  const subscribe = useCallback(
    (listener: () => void) => subscribePreference(key, listener),
    [key]
  );
  const getSnapshot = useCallback(() => getPreference(key), [key]);
  const getServerSnapshot = useCallback(() => DEFAULT_PREFERENCES[key], [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    void loadPreferences();
  }, []);
  return value;
}

/** 只取 NSFW 档位，避免无关组件因其他偏好变化而重渲染 */
export function useNsfwMode(): NsfwMode {
  return usePreference("nsfwMode");
}

/** 全局作品图片圆角（dp） */
export function useImageRadius(): number {
  return usePreference("imageRadius");
}

/**
 * 根据 NSFW 档位决定一张图的展示方式（纯函数）。
 *
 * `sexual` / `violence` 是 0(安全) / 1(暗示) / 2(露骨)，缺字段时按 2(露骨) 处理 ——
 * 宁可多遮一次，也不要漏放。
 *
 * 网格这类需要**自己判断「这张图会不会被隐藏」**的场景直接用它，
 * 不必为每个格子再挂一层 hook。
 */
export function imageGate(mode: NsfwMode, flags: { sexual?: number; violence?: number }) {
  const level = Math.max(flags.sexual ?? 2, flags.violence ?? 2);
  const isSensitive = level >= 1;

  return {
    mode,
    level,
    isSensitive,
    /** 完全不渲染 */
    hidden: mode === "hide" && isSensitive,
    /** 加模糊（只模糊「露骨」级，「暗示」级直接显示） */
    blurred: mode === "blur" && level >= 2,
  } as const;
}

/** `imageGate` 的 React 绑定版（订阅当前 NSFW 档位） */
export function useImageGate(flags: { sexual?: number; violence?: number }) {
  return imageGate(useNsfwMode(), flags);
}
