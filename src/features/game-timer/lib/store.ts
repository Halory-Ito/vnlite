/**
 * 游戏计时器的全局状态。
 *
 * 与 `lib/storage/preferences` / `session` 同一套模式：**模块级单例 + 订阅者**，
 * 由 `hooks.ts` 用 `useSyncExternalStore` 接到 React 树上。
 *
 * 之所以放在 React 之外：计时器要**跨页面常驻**（进详情页开始、切到别的
 * 页面/返回都还在跑），状态必须活得比任何屏幕都久。持久化见 `persistence.ts`，
 * 冷启动按时间戳恢复 —— 因此**后台 / 杀进程期间也一直在计**。
 *
 * 计时不用「每秒累加」，而是记**本段起点 `segmentStartedAt` + 已累计
 * `accumulatedMs`**，当前耗时 = `accumulatedMs + (running ? now - segmentStartedAt : 0)`。
 *
 * 另记 `sessionStartedAt`（本次会话开始的墙钟时间）：暂停 / 继续不重置它，
 * 结束后连同时长一起落成一条游玩记录。
 *
 * 全局**同时只有一个**计时器。
 */

export type GameTimerStatus = "idle" | "running" | "paused";

export interface GameTimerState {
  status: GameTimerStatus;
  /** 正在 / 最近计时的作品 id；idle 时为 null */
  vnId: string | null;
  vnTitle: string | null;
  /** 本次会话开始的墙钟时间（unix 毫秒）；idle 时为 null */
  sessionStartedAt: number | null;
  /** 当前运行段起点（unix 毫秒）；仅 running 有值 */
  segmentStartedAt: number | null;
  /** 之前各段累计的毫秒数（暂停时冻结） */
  accumulatedMs: number;
}

/** 一次结束后的成果，交给调用方落库 */
export interface FinishedSession {
  vnId: string;
  vnTitle: string;
  /** 会话开始（unix 毫秒） */
  startedAt: number;
  /** 结束（unix 毫秒） */
  endedAt: number;
  /** 实际游玩时长（毫秒，不含暂停） */
  durationMs: number;
}

/** 空档位。导出给 `useSyncExternalStore` 的 server snapshot 用 */
export const IDLE_GAME_TIMER: GameTimerState = {
  status: "idle",
  vnId: null,
  vnTitle: null,
  sessionStartedAt: null,
  segmentStartedAt: null,
  accumulatedMs: 0,
};

let snapshot: GameTimerState = IDLE_GAME_TIMER;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getGameTimer(): GameTimerState {
  return snapshot;
}

export function subscribeGameTimer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 某个状态在 `now` 时刻的已计时毫秒数 */
export function elapsedMs(state: GameTimerState, now: number): number {
  const running = state.status === "running" && state.segmentStartedAt != null;
  const segment = running ? now - state.segmentStartedAt! : 0;
  return Math.max(0, state.accumulatedMs + segment);
}

/** 开始计一个作品的游戏时间（会替换正在跑的那个） */
export function startGameTimer(vnId: string, vnTitle: string): void {
  const now = Date.now();
  snapshot = {
    status: "running",
    vnId,
    vnTitle,
    sessionStartedAt: now,
    segmentStartedAt: now,
    accumulatedMs: 0,
  };
  emit();
}

/** 暂停：把本段耗时并入累计，冻结段起点（会话起点不动） */
export function pauseGameTimer(): void {
  if (snapshot.status !== "running" || snapshot.segmentStartedAt == null) return;
  snapshot = {
    ...snapshot,
    status: "paused",
    accumulatedMs: elapsedMs(snapshot, Date.now()),
    segmentStartedAt: null,
  };
  emit();
}

/** 继续：重置本段起点 */
export function resumeGameTimer(): void {
  if (snapshot.status !== "paused") return;
  snapshot = { ...snapshot, status: "running", segmentStartedAt: Date.now() };
  emit();
}

/** 暂停 / 继续之间切换 */
export function toggleGameTimerPause(): void {
  if (snapshot.status === "running") pauseGameTimer();
  else if (snapshot.status === "paused") resumeGameTimer();
}

/**
 * 结束计时，回到空档位。
 *
 * 返回本次会话的成果（供落库）；本来就空闲时返回 null。
 */
export function stopGameTimer(): FinishedSession | null {
  if (snapshot.status === "idle" || snapshot.vnId == null) return null;
  const now = Date.now();
  const finished: FinishedSession = {
    vnId: snapshot.vnId,
    vnTitle: snapshot.vnTitle ?? "",
    startedAt: snapshot.sessionStartedAt ?? now,
    endedAt: now,
    durationMs: elapsedMs(snapshot, now),
  };
  snapshot = IDLE_GAME_TIMER;
  emit();
  return finished;
}

/** 冷启动从持久化数据恢复（脏数据一律回空闲）。见 `persistence.ts` */
export function restoreGameTimer(state: GameTimerState | null): void {
  snapshot = sanitizeGameTimer(state);
  emit();
}

/** 校验持久化数据，非法时返回空闲档位 */
export function sanitizeGameTimer(state: GameTimerState | null): GameTimerState {
  if (!state || (state.status !== "running" && state.status !== "paused")) {
    return IDLE_GAME_TIMER;
  }
  const { vnId, vnTitle, sessionStartedAt, segmentStartedAt, accumulatedMs } = state;
  const hasSegment = typeof segmentStartedAt === "number" && Number.isFinite(segmentStartedAt);
  if (
    typeof vnId !== "string" ||
    vnId === "" ||
    typeof sessionStartedAt !== "number" ||
    !Number.isFinite(sessionStartedAt) ||
    typeof accumulatedMs !== "number" ||
    !Number.isFinite(accumulatedMs)
  ) {
    return IDLE_GAME_TIMER;
  }
  // running 必须有段起点，否则降级为暂停（避免「在跑却没有起点」的危险状态）
  const status: GameTimerStatus = state.status === "running" && hasSegment ? "running" : "paused";
  return {
    status,
    vnId,
    vnTitle: typeof vnTitle === "string" ? vnTitle : "",
    sessionStartedAt,
    segmentStartedAt: status === "running" ? segmentStartedAt : null,
    accumulatedMs: Math.max(0, accumulatedMs),
  };
}
