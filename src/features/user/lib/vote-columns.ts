/**
 * 打分列表的**可视列**定义与取值格式化（纯逻辑，UI 与筛选面板共用）。
 *
 * 单独抽出来是因为筛选面板要列出列名、列表要按列取值，两边必须同源 ——
 * 各写一份迟早对不上（多一列少一列）。
 */

import type { TranslationKey } from "@/lib/i18n/translate";
import type { UListItem } from "@/lib/api/types";

import type { VndbLengthVote } from "./scrape";

/** 可控的列（文案存翻译键：语言可切换） */
export const VOTE_COLUMNS = [
  { key: "title", labelKey: "user.columnTitle" },
  { key: "score", labelKey: "user.columnScore" },
  { key: "playtime", labelKey: "user.columnPlaytime" },
  { key: "speed", labelKey: "user.columnSpeed" },
  { key: "votedAt", labelKey: "user.columnVotedAt" },
  { key: "started", labelKey: "user.columnStarted" },
  { key: "finished", labelKey: "user.columnFinished" },
] as const satisfies readonly { key: string; labelKey: TranslationKey }[];

/** 行内短标签（`vote-row` 用；与面板上的完整列名不同） */
export const VOTE_FIELD_LABEL_KEY: Record<Exclude<VoteColumn, "title">, TranslationKey> = {
  score: "user.fieldScore",
  playtime: "user.fieldPlaytime",
  speed: "user.fieldSpeed",
  votedAt: "user.fieldVotedAt",
  started: "user.fieldStarted",
  finished: "user.fieldFinished",
};

export type VoteColumn = (typeof VOTE_COLUMNS)[number]["key"];

export const DEFAULT_VOTE_COLUMNS: VoteColumn[] = ["title", "score", "playtime", "votedAt"];

/** 一个开关切换后的列集合（保持 `VOTE_COLUMNS` 的固定顺序） */
export function toggleVoteColumn(current: readonly VoteColumn[], key: VoteColumn): VoteColumn[] {
  const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
  return VOTE_COLUMNS.map((column) => column.key).filter((column) =>
    next.includes(column as VoteColumn)
  ) as VoteColumn[];
}

/** `/ulist` 的 `vote` 是 10–100；除以 10 还原成 1–10 的原始分 */
export function formatVote(vote: number | null | undefined): string {
  if (vote == null) return "—";
  return (vote / 10).toFixed(1).replace(/\.0$/, "");
}

/** unix 秒 → `YYYY-MM-DD`（本地时区） */
export function formatUnixDate(unix: number | null | undefined): string {
  if (unix == null) return "—";
  const date = new Date(unix * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 一行里「某列该显示什么」。`visible` 之外的列返回 null（不渲染） */
export function voteColumnValue(
  column: VoteColumn,
  item: UListItem,
  length: VndbLengthVote | undefined
): string | null {
  switch (column) {
    case "title":
      return item.vn?.title ?? item.id;
    case "score":
      return formatVote(item.vote);
    case "playtime":
      return length?.time || "—";
    case "speed":
      return length?.speed ?? "—";
    case "votedAt":
      return formatUnixDate(item.voted);
    case "started":
      return item.started ?? "—";
    case "finished":
      return item.finished ?? "—";
    default:
      return null;
  }
}

/** 需要强调色（评分是这一页的主角数字） */
export function isAccentColumn(column: VoteColumn): boolean {
  return column === "score";
}
