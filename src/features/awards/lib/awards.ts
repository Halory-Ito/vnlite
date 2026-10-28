/**
 * 历届大赏数据（打包 JSON，静态历史，无需联网）。
 *
 * 两类大赏：
 * - **萌えゲーアワード** —— `awards.json`，主线层级（大賞/準大賞/金/銀/銅）
 *   按年份排列：2006-2008 是「美少女ゲームアワード」单一大赏、2009-2012
 *   金銀銅、2013-2020 大賞+準大賞、2021 起 gp.html 单一大赏页
 *   （采集见 `scripts/sync-awards.ts`：官网 + 日文维基获奖表）。
 * - **美少女ゲーム大賞**（Getchu 年度投票）—— `getchu.json`，年份 × 部门 × 名次；
 *   8 个部门体系 2010 年起定型，Getchu 2024 停服
 *   （采集见 `scripts/sync-getchu-awards.ts`）。
 *
 * 标题匹配到 VNDB 的行有 vnId（v 号），没匹配到的在界面显示成不可点文本。
 */

import rawMoe from "./awards.json";
import rawGetchu from "./getchu.json";

/** 萌系大赏的主线层级 */
export type MoePrize = "grand" | "semi" | "gold" | "silver" | "bronze";

/** Getchu 的部门（= 官网 8 个部门按钮的顺序） */
export type GetchuDept =
  | "total"
  | "scenario"
  | "system"
  | "graphic"
  | "music"
  | "movie"
  | "chara"
  | "eros";

export interface MoeAward {
  /** 颁奖年度 */
  year: number;
  prize: MoePrize;
  /** 作品名（日文原名） */
  title: string;
  /** 品牌 / 厂商 */
  brand: string;
  /** VNDB 作品 id；匹配不到是 null */
  vnId: string | null;
}

export interface GetchuAward {
  year: number;
  dept: GetchuDept;
  /** 名次（1 起，各年部门多少不一，角色部门按作品去重后可能 ≤10） */
  rank: number;
  /** 展示标题：角色部门是「角色名 ～『作品名』より」，其余是作品名 */
  title: string;
  /** 品牌（角色部门拿不到，空串） */
  brand: string;
  /** VNDB 作品 id；匹配不到是 null */
  vnId: string | null;
}

/** 萌系：年份降序，年内 大賞 → 準大賞 → 金 → 銀 → 銅 */
export const MOE_AWARDS = rawMoe as MoeAward[];

/** Getchu：年份降序 → 部门 → 名次 */
export const GETCHU_AWARDS = rawGetchu as GetchuAward[];

/** 层级的展示顺序 */
export const MOE_PRIZE_ORDER: Record<MoePrize, number> = {
  grand: 0,
  semi: 1,
  gold: 2,
  silver: 3,
  bronze: 4,
};

/** 部门的展示顺序 */
export const GETCHU_DEPT_ORDER: Record<GetchuDept, number> = {
  total: 0,
  scenario: 1,
  system: 2,
  graphic: 3,
  music: 4,
  movie: 5,
  chara: 6,
  eros: 7,
};

/** 萌系的所有年份（新 → 旧） */
export const moeYears = (): number[] =>
  [...new Set(MOE_AWARDS.map((a) => a.year))].sort((a, b) => b - a);

/** 某一年的萌系全部获奖行（大賞在先，角色部门可并列） */
export const moeEntriesFor = (year: number): MoeAward[] =>
  MOE_AWARDS.filter((a) => a.year === year).sort(
    (a, b) => MOE_PRIZE_ORDER[a.prize] - MOE_PRIZE_ORDER[b.prize]
  );

/** Getchu 的所有年份（新 → 旧） */
export const getchuYears = (): number[] =>
  [...new Set(GETCHU_AWARDS.map((a) => a.year))].sort((a, b) => b - a);

/** Getchu 年份 × 部门的获奖行（按名次升序） */
export const getchuEntriesFor = (year: number, dept: GetchuDept): GetchuAward[] =>
  GETCHU_AWARDS.filter((a) => a.year === year && a.dept === dept).sort((a, b) => a.rank - b.rank);

/** 某年某部门有没有数据（抓取失败的部门/年份 chip 不给选） */
export const getchuHasDept = (year: number, dept: GetchuDept): boolean =>
  GETCHU_AWARDS.some((a) => a.year === year && a.dept === dept);
