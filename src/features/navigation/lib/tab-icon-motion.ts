/** Search's whole selection cycle returns to a magnifier, and reverses on exit. */
export function iconAnimationProgress(progress: number, returnToStart: boolean): number {
  "worklet";
  const clamped = Math.min(1, Math.max(0, progress));
  return returnToStart ? 1 - Math.abs(clamped * 2 - 1) : clamped;
}

/** Keep speed constant when a rapid Tab switch reverses a partially played icon. */
export function iconAnimationDuration(current: number, target: number, duration: number): number {
  return Math.round(Math.abs(target - current) * duration);
}
