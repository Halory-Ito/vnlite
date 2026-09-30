/**
 * 摇一摇手势。
 *
 * 走 `expo-sensors` 的 Accelerometer（Expo Go 内置，不需要权限）：
 *   - 只在**页面聚焦时**订阅，离开立即退订（省电，也避免后台误触发）
 *   - 用合加速度判断：静止时约 1g，超过 `threshold`（默认 1.8g）算一次摇动
 *   - `cooldownMs` 防止一次甩动连着触发好几次（默认 1.5s）
 *   - 传感器不可用（模拟器 / web）时静默不订阅，不报错
 *
 * 只在首页的「随机一部」卡片上用：全局摇一摇会在读长文时把人甩走，
 * 而首页本来就是「摇一部来玩」的语境。
 */

import { Accelerometer } from "expo-sensors";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

export interface UseShakeOptions {
  /** 触发阈值（g）。静止约 1g，1.8 需要明显甩动 */
  threshold?: number;
  /** 两次触发的最小间隔（ms） */
  cooldownMs?: number;
  /** 传感器采样间隔（ms） */
  updateIntervalMs?: number;
  enabled?: boolean;
}

export function useShake(onShake: () => void, options: UseShakeOptions = {}): void {
  const { threshold = 1.8, cooldownMs = 1500, updateIntervalMs = 100, enabled = true } = options;

  // 回调放 ref：订阅只建一次，回调每次渲染都可以是新的
  const onShakeRef = useRef(onShake);
  const lastFiredAt = useRef(0);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let subscription: { remove: () => void } | null = null;
      let cancelled = false;

      void Accelerometer.isAvailableAsync().then((available) => {
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(updateIntervalMs);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          if (magnitude < threshold) return;
          const now = Date.now();
          if (now - lastFiredAt.current < cooldownMs) return;
          lastFiredAt.current = now;
          onShakeRef.current();
        });
      });

      return () => {
        cancelled = true;
        subscription?.remove();
      };
    }, [enabled, threshold, cooldownMs, updateIntervalMs])
  );
}
