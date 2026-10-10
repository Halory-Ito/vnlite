/**
 * 清单编辑页的纯逻辑：draft ↔ `UListPatch` 转换与日期校验。
 *
 * 纯函数，冒烟可直接测（编辑页的 tsx 里不写业务判断）。
 * 数据源是**服务端的 `UListItem`**（清单不落本地库）。
 */

import type { UListPatch } from "@/lib/api/endpoints/ulist";
import type { UListItem } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translate";

export interface UlistDraft {
  vote: number | null;
  labels: number[];
  notes: string;
  started: string;
  finished: string;
}

export function draftFrom(entry: UListItem): UlistDraft {
  return {
    vote: entry.vote ?? null,
    labels: (entry.labels ?? []).map((label) => label.id),
    notes: entry.notes ?? "",
    started: entry.started ?? "",
    finished: entry.finished ?? "",
  };
}

/** 与当前条目对比出要提交的 patch；没有变化返回 null */
export function diffPatch(entry: UListItem, draft: UlistDraft): UListPatch | null {
  const patch: UListPatch = {};
  const current = draftFrom(entry);

  if (draft.vote !== current.vote) patch.vote = draft.vote;

  const notes = draft.notes.trim();
  if (notes !== current.notes) patch.notes = notes === "" ? null : notes;
  if (draft.started !== current.started) {
    patch.started = draft.started === "" ? null : draft.started;
  }
  if (draft.finished !== current.finished) {
    patch.finished = draft.finished === "" ? null : draft.finished;
  }
  if (!sameLabels(draft.labels, current.labels)) patch.labels = draft.labels;

  return Object.keys(patch).length > 0 ? patch : null;
}

export function sameLabels(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

/**
 * 校验路由参数是不是合法的 VN id（vndbid：`v` + 数字）。
 *
 * 路由参数是字符串，任何脏值（`undefined`、空串、手输的 URL）都会原样送进
 * `/ulist` 的 `id` 过滤器，换来一个看不懂的 `400 Invalid 'id' filter`。
 * 编辑页在发请求之前先用它把参数挡掉，给一个能看懂的空态。
 */
export function isVnId(value: string): boolean {
  return /^v\d+$/.test(value);
}

/** 严格校验 `YYYY-MM-DD`（`2023-02-31` 这类不存在的日期也要挡住） */
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** 两个日期的校验错误（字段 → 翻译键；合法时为 null，由调用方翻成文案） */
export function dateErrors(
  started: string,
  finished: string
): { started: TranslationKey | null; finished: TranslationKey | null } {
  const startedError = started !== "" && !isValidDate(started) ? "ulist.dateFormatError" : null;
  const finishedError =
    finished !== "" && !isValidDate(finished)
      ? "ulist.dateFormatError"
      : started !== "" && finished !== "" && isValidDate(started) && finished < started
        ? "ulist.dateRangeError"
        : null;
  return { started: startedError, finished: finishedError };
}
