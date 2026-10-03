/**
 * 攻略标记（本地）。
 *
 * 攻略本质是一份**待办清单**：照着走一遍就完成了一个结局。所以标记只有三件事 ——
 * 步骤「已走过」、步骤「重点」、结局「已达成」。
 *
 * ## 为什么标记必须落本地，而且独立于「缓存」
 *
 * 缓存是**加速手段**（LRU 淘汰、随时可清），标记是**用户数据**（不能被悄悄删掉）。
 * 两者必须分键存放 —— 否则设置页那个「清空浏览缓存」会连带清掉用户的进度。
 *
 * 所以：
 *   - `vnlite.walkthrough_marks.<vid>` —— 标记，**永不被 LRU 淘汰**
 *   - `vnlite.walkthrough.body.<vid>`   —— 攻略正文，标记过的那些会被「钉住」不淘汰
 *
 * ## 标记会连带保存攻略
 *
 * 离线时看不到攻略正文，那标记也就没有意义（进度条全是「未标记」）。
 * 所以「打第一个标记」这个动作会把该篇攻略钉为本地保留。
 *
 * ## 步骤 id 会漂移
 *
 * 步骤的 `id` 来自作者维护的 JSON（`step_001` 或时间戳）。作者重排步骤后旧 id 可能消失，
 * 那条标记就成了孤儿（数据仍在，只是不再显示）。刻意不做自动清理 ——
 * 静默删用户数据比留一个看不见的孤儿更糟。
 */

import { kv } from "@/lib/storage/key-value";

/** 步骤上的两种标记 */
export type MarkField = "done" | "starred";

export interface StepMark {
  /** 已走过 */
  done?: true;
  /** 重点 */
  starred?: true;
}

export interface WalkthroughMarks {
  vid: string;
  /** 已达成的结局 id */
  endings: string[];
  /** stepId → 标记 */
  steps: Record<string, StepMark>;
  /** 最近修改时间（毫秒时间戳） */
  updatedAt: number;
}

export const EMPTY_MARKS: WalkthroughMarks = {
  vid: "",
  endings: [],
  steps: {},
  updatedAt: 0,
};

const key = (vid: string): string => `vnlite.walkthrough_marks.${vid}`;

/* -------------------------------------------------------------------------- */
/* 解析（容错）                                                                */
/* -------------------------------------------------------------------------- */

/** 从存储读出的脏数据收敛成合法结构。缺字段补默认值，坏元素丢掉 */
export function parseMarks(raw: unknown, vid: string): WalkthroughMarks {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...EMPTY_MARKS, vid };
  }
  const record = raw as Record<string, unknown>;

  const endings = Array.isArray(record.endings)
    ? [...new Set(record.endings.filter((id): id is string => typeof id === "string"))]
    : [];

  const steps: Record<string, StepMark> = {};
  if (typeof record.steps === "object" && record.steps !== null) {
    for (const [id, value] of Object.entries(record.steps as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const mark = value as Record<string, unknown>;
      // 只认严格 true：`"true"` / 1 之类一律当作没标记
      const next: StepMark = {};
      if (mark.done === true) next.done = true;
      if (mark.starred === true) next.starred = true;
      if (next.done || next.starred) steps[id] = next;
    }
  }

  return {
    vid,
    endings,
    steps,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* 纯函数：标记操作                                                            */
/* -------------------------------------------------------------------------- */

const stamp = (marks: WalkthroughMarks): WalkthroughMarks => ({
  ...marks,
  updatedAt: Date.now(),
});

/** 单个步骤的某个标记取反。没有任何标记时该键直接删掉，不留空壳 */
export function toggleStepMark(
  marks: WalkthroughMarks,
  stepId: string,
  field: MarkField
): WalkthroughMarks {
  const current = marks.steps[stepId];
  const steps = { ...marks.steps };
  const next = { ...current };

  if (next[field]) delete next[field];
  else next[field] = true;

  if (next.done || next.starred) steps[stepId] = next;
  else delete steps[stepId];

  return stamp({ ...marks, steps });
}

/** 批量把若干步骤标成「已走过」（分组标题上的「完成」用）。已标记的跳过，不取消 */
export function markStepsDone(
  marks: WalkthroughMarks,
  stepIds: readonly string[]
): WalkthroughMarks {
  if (stepIds.length === 0) return marks;
  const steps = { ...marks.steps };
  for (const id of stepIds) steps[id] = { ...steps[id], done: true };
  return stamp({ ...marks, steps });
}

/** 结局「已达成」取反 */
export function toggleEnding(marks: WalkthroughMarks, endingId: string): WalkthroughMarks {
  const endings = marks.endings.includes(endingId)
    ? marks.endings.filter((id) => id !== endingId)
    : [...marks.endings, endingId];
  return stamp({ ...marks, endings });
}

/* -------------------------------------------------------------------------- */
/* 查询                                                                        */
/* -------------------------------------------------------------------------- */

export function isDone(marks: WalkthroughMarks, stepId: string): boolean {
  return marks.steps[stepId]?.done === true;
}

export function isStarred(marks: WalkthroughMarks, stepId: string): boolean {
  return marks.steps[stepId]?.starred === true;
}

export function isAchieved(marks: WalkthroughMarks, endingId: string): boolean {
  return marks.endings.includes(endingId);
}

/** 有没有任何标记（用来判断要不要写盘、要不要显示「清除」） */
export function hasAnyMark(marks: WalkthroughMarks): boolean {
  return marks.endings.length > 0 || Object.keys(marks.steps).length > 0;
}

/** 命中的标记数量（用于「进度 X / Y」里的 X） */
export function countMarkedSteps(marks: WalkthroughMarks): number {
  return Object.keys(marks.steps).length;
}

/* -------------------------------------------------------------------------- */
/* 落盘                                                                        */
/* -------------------------------------------------------------------------- */

export async function readMarks(vid: string): Promise<WalkthroughMarks> {
  return parseMarks(await kv.get(key(vid)), vid);
}

export async function writeMarks(marks: WalkthroughMarks): Promise<void> {
  if (!marks.vid) return;
  await kv.set(key(marks.vid), marks);
}

/** 清除单篇的标记（「清除本篇标记」） */
export async function clearMarks(vid: string): Promise<void> {
  await kv.remove(key(vid));
}
