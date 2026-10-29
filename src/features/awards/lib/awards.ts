/**
 * 历届大赏数据（打包 JSON，静态历史，无需联网）。
 *
 * 两类大赏：
 * - **萌えゲーアワード** —— `awards.json`，主线层级（大賞/準大賞/金/銀/銅）
 *   按年份排列：2006-2008 是「美少女ゲームアワード」单一大赏、2009-2012
 *   金銀銅、2013-2020 大賞+準大賞、2021 起单一大赏
 * - **美少女ゲーム大賞**（Getchu 年度投票）—— `getchu.json`，年份 × 部门 × 名次
 *
 * 两份数据统一由仓库根的 `award-data.csv`（萌娘百科获奖表）生成，
 * 见 `scripts/sync-awards-csv.ts`。
 *
 * 标题匹配到 VNDB 的行有 vnId（v 号），没匹配到的在界面显示成不可点文本。
 */

import rawMoe from "./awards.json";
import rawGetchu from "./getchu.json";

/** 萌系大赏的主线层级 */
export type MoePrize = "grand" | "semi" | "gold" | "silver" | "bronze";

/**
 * Getchu 的部门。前 8 个是 2010 年起定型的常设部门（顺序同官网按钮），
 * 后 5 个是早年短暂出现过的部门（作品命名 / 配音 / 主题曲 / Vocal / BGM）。
 */
export type GetchuDept =
  | "total"
  | "scenario"
  | "system"
  | "graphic"
  | "music"
  | "movie"
  | "chara"
  | "eros"
  | "naming"
  | "voice"
  | "theme"
  | "vocal"
  | "bgm";

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
  /** 名次（1 起，各年部门多少不一） */
  rank: number;
  /** 展示标题：作品名（角色 / 配音部门同样以作品名为主标题） */
  title: string;
  /** 副标题：角色 / 配音部门放角色名，其余放厂商 */
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
  naming: 8,
  voice: 9,
  theme: 10,
  vocal: 11,
  bgm: 12,
};

/** 萌系的所有年份（新 → 旧） */
export const moeYears = (): number[] =>
  [...new Set(MOE_AWARDS.map((a) => a.year))].sort((a, b) => b - a);

/** 某一年的萌系全部获奖行（大賞在先，同奖项可并列） */
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

/** 某年某部门有没有数据（该年没这个部门时 chip 不给选） */
export const getchuHasDept = (year: number, dept: GetchuDept): boolean =>
  GETCHU_AWARDS.some((a) => a.year === year && a.dept === dept);
