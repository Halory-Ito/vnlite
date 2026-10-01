/**
 * 双击手势。
 *
 * `Pressable` 的 `onPress` 每次点击都会触发，而列表里整行 `Pressable`
 * 已经占用了单击（跳详情），所以敏感内容的显示/隐藏必须用**双击**才不冲突
 * （与 vndb-lite 的 "Double-click to censor/uncensor" 一致）。
 *
 * 300ms 是移动端双击的常用阈值。再长容易被系统当成长按，
 * 再短会和快速连续点击浏览混在一起。
 *
 * ## 单击也要用怎么办
 *
 * 传入 `onSingleTap`：单击会**等一个双击窗口**再触发（晚了 300ms，
 * 但换来「双击不会连带触发单击」）。只在需要区分两种手势时才用。
 */

import { useCallback, useEffect, useRef } from "react";
import type { GestureResponderEvent } from "react-native";

const DOUBLE_TAP_MS = 300;

export interface DoubleTapHandlers {
  onPress: (event: GestureResponderEvent) => void;
  onDoubleTap: () => void;
}

/**
 * 返回可以挂在 `Pressable` 上的 `onPress`。
 * 两次点击间隔小于阈值才算双击，否则当单击处理。
 * `onDoubleTap` 传 `undefined` 表示没有双击手势：单击**立即**触发，不做延迟。
 */
export function useDoubleTap(
  onDoubleTap?: () => void,
  onSingleTap?: () => void
): DoubleTapHandlers {
  const lastTap = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // 卸载时别让待触发的单击打到已卸载的组件上
  useEffect(() => clearTimer, [clearTimer]);

  return {
    onPress: useCallback(
      (event: GestureResponderEvent) => {
        if (!onDoubleTap) {
          onSingleTap?.();
          return;
        }
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          clearTimer();
          lastTap.current = 0;
          onDoubleTap();
        } else {
          lastTap.current = now;
          if (onSingleTap) {
            clearTimer();
            timer.current = setTimeout(() => {
              timer.current = null;
              onSingleTap();
            }, DOUBLE_TAP_MS);
          }
        }
        void event;
      },
      [onDoubleTap, onSingleTap, clearTimer]
    ),
    onDoubleTap: onDoubleTap ?? noop,
  };
}

function noop(): void {
  // 无双击手势时的占位实现
}
