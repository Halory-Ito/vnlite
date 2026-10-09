/**
 * 游戏计时的展示格式。
 *
 * 浮层圆形显示**时、分、秒**（`HH:MM:SS`），小时不封顶（长会话会超过 24 小时）。
 */

const pad = (n: number): string => String(n).padStart(2, "0");

/** 毫秒 → `HH:MM:SS`（负数按 0 处理） */
export function formatGameDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
