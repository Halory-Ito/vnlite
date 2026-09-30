/**
 * `bun:sqlite` 的最小类型声明（只声明冒烟脚本用到的部分）。
 *
 * 项目不装 `@types/bun` —— 它会往全局塞一堆与 React Native 冲突的类型；
 * 这里只为 `scripts/smoke-db.ts` 的测试适配器提供类型。
 */

declare module "bun:sqlite" {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface Statement {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): RunResult;
  }

  export class Database {
    constructor(path?: string, options?: { create?: boolean; readonly?: boolean });
    query(sql: string): Statement;
    exec(sql: string): unknown;
    close(): void;
  }
}
