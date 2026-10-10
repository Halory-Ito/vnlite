/**
 * `Bun` 全局的最小类型声明（只声明同步脚本用到的部分）。
 *
 * 与 `bun-sqlite.d.ts` 同一个理由：项目不装 `@types/bun` / `@types/node`，
 * 这里只为脚本提供类型。
 */

declare const Bun: {
  write(path: string, data: string | Uint8Array): Promise<number>;
};
