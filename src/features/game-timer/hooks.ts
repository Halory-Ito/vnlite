/**
 * 游戏计时器的 React 绑定。
 *
 * `store.ts` 是模块级单例，这里用 `useSyncExternalStore` 接上。
 *
 * 秒级跳动由**一个独立的时钟源**驱动（而不是在渲染里直接读 `Date.now()`——
 * oxlint 的 purity 规则禁止在渲染期调用非纯函数）：
 *   - 仅当计时器 `running` 时才订阅时钟，暂停 / 空闲时定时器自动停掉
 *   - 时钟快照 `clockNow` 只在 `setInterval` 回调里更新，渲染期读到的是稳定值
 */

import { useSyncExternalStore } from "react";

import {
  elapsedMs,
  getGameTimer,
  IDLE_GAME_TIMER,
  subscribeGameTimer,
  type GameTimerState,
} from "./store";

/** 订阅计时器状态（只在开始 / 暂停 / 结束时变化，不随时间跳动） */
export function useGameTimer(): GameTimerState {
  return useSyncExternalStore(subscribeGameTimer, getGameTimer, () => IDLE_GAME_TIMER);
}

/* -------------------------------------------------------------------------- */
/* 秒级时钟（ref-count：有订阅者才走）                                          */
/* -------------------------------------------------------------------------- */

let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function emitClock(): void {
  for (const listener of clockListeners) listener();
}

function subscribeClock(onChange: () => void): () => void {
  clockListeners.add(onChange);
  // 订阅即刻对齐一次，避免首帧用上一次的旧值
  clockNow = Date.now();
  onChange();
  if (clockTimer == null) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      emitClock();
    }, 1000);
  }
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer != null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClockNow(): number {
  return clockNow;
}

/** 非运行态用：不订阅任何东西，引用稳定 */
function subscribeNothing(): () => void {
  return () => {};
}

/** 当前已计时毫秒数；运行中每秒刷新一次，暂停 / 空闲时不产生定时器 */
export function useElapsedMs(): number {
  const state = useGameTimer();
  const running = state.status === "running";
  const now = useSyncExternalStore(
    running ? subscribeClock : subscribeNothing,
    getClockNow,
    getClockNow
  );
  return elapsedMs(state, now);
}
