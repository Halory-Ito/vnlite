/**
 * 游戏计时器的持久化。
 *
 * 计时状态写 AsyncStorage（KV 层），冷启动恢复。因为耗时是按**时间戳**算的，
 * 恢复后会把后台 / 关闭期间的时间一并计入 —— 这就是「后台运行」。
 *
 * 与 store 分离：store 保持纯净（可被 bun 冒烟直接 import），
 * 这里才依赖 AsyncStorage。
 */

import { kv } from "@/lib/storage/key-value";

import { getGameTimer, restoreGameTimer, subscribeGameTimer, type GameTimerState } from "./store";

const KEY = "vnlite.gameTimer";

let hydrated = false;
let initialized = false;

/**
 * 启动持久化：订阅状态自动落盘 + 冷启动恢复一次。
 * 返回取消函数（供 React effect 清理）。
 */
export function initGameTimerPersistence(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const unsubscribe = subscribeGameTimer(() => {
    // 水合完成前不写盘，避免用默认空值覆盖已存的计时
    if (hydrated) persist(getGameTimer());
  });

  void hydrate();

  return () => {
    unsubscribe();
    initialized = false;
  };
}

async function hydrate(): Promise<void> {
  const stored = await kv.get<GameTimerState>(KEY);
  // 加载期间用户可能已经点了「开始游戏」，只在仍空闲时才恢复
  if (stored && getGameTimer().status === "idle") restoreGameTimer(stored);
  hydrated = true;
}

function persist(state: GameTimerState): void {
  if (state.status === "idle") void kv.remove(KEY);
  else void kv.set(KEY, state);
}
