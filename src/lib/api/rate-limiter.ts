/**
 * 滑动窗口限流器。
 *
 * VNDB 限制为「每 5 分钟 200 次请求」。所有出网请求必须先 `acquire()`，
 * 否则浏览十几屏列表就会吃 429。
 *
 * 用滑动窗口（记录每个请求的时间戳）而不是固定桶，理由：
 * 固定桶会在窗口交界处放行两倍流量（400 次/瞬间），直接触发服务端 429。
 */

import { RATE_LIMIT } from "@/constants/config";

export interface RateLimiterOptions {
  /** 窗口内允许的最大请求数 */
  max?: number;
  /** 窗口长度（毫秒） */
  windowMs?: number;
  /** 时间源，便于测试注入 */
  now?: () => number;
}

export class RateLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  /** 滑动窗口内的请求时间戳，按升序 */
  private timestamps: number[] = [];
  /** 等待者队列，按入队顺序串行放行，避免惊群 */
  private queue: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.max = options.max ?? RATE_LIMIT.max;
    this.windowMs = options.windowMs ?? RATE_LIMIT.windowMs;
    this.now = options.now ?? Date.now;
  }

  /** 丢弃窗口外的记录，返回当前窗口内已用次数 */
  private prune(at: number): number {
    const cutoff = at - this.windowMs;
    let i = 0;
    while (i < this.timestamps.length && (this.timestamps[i] as number) <= cutoff) i += 1;
    if (i > 0) this.timestamps = this.timestamps.slice(i);
    return this.timestamps.length;
  }

  /** 若现在可以发请求，返回还需等待的毫秒数（0 表示可以） */
  msUntilReady(at: number = this.now()): number {
    const used = this.prune(at);
    if (used < this.max) return 0;
    const oldest = this.timestamps[0] as number;
    return Math.max(0, oldest + this.windowMs - at);
  }

  /** 排队等待一个发送名额。返回的函数必须在真正发出请求后调用 */
  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      this.queue.push(() => {
        const commit = () => {
          this.timestamps.push(this.now());
          return commit;
        };
        resolve(commit);
      });
      this.pump();
    });
  }

  /** 串行放行队列中的等待者 */
  private pump(): void {
    if (this.timer !== null) return;

    const wait = this.msUntilReady();
    if (this.queue.length === 0) return;

    if (wait === 0) {
      const next = this.queue.shift();
      next?.();
      // 连续放行直到配额用完，然后再排下一个窗口
      this.pump();
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, wait);
  }

  /** 已用配额 / 上限，给设置页「当前速率」展示用 */
  usage(): { used: number; max: number; resetsInMs: number } {
    const at = this.now();
    const used = this.prune(at);
    return { used, max: this.max, resetsInMs: this.msUntilReady(at) };
  }

  /** 登出 / 切账号时清空 */
  reset(): void {
    this.timestamps = [];
  }

  /** 测试用：是否有等待者 */
  get pending(): number {
    return this.queue.length;
  }
}

/** 全局单例：前台查询与写队列共用同一份配额 */
export const rateLimiter = new RateLimiter();
