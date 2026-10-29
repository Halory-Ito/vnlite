/**
 * `Bun` 全局的最小类型声明（只声明同步脚本用到的部分）。
 *
 * 与 `bun-sqlite.d.ts` 同一个理由：项目不装 `@types/bun` / `@types/node`，
 * 这里只为脚本提供类型。
 */

declare const Bun: {
  write(path: string, data: string | Uint8Array): Promise<number>;
  /** 读文件：`json()` 给配置类，`text()` 给 CSV / 页面原文 */
  file(path: string): { json(): Promise<unknown>; text(): Promise<string> };
};

/** bun 给 fetch 的独有代理参数（Sync 脚本走本地代理用），DOM lib 里没有 */
interface RequestInit {
  proxy?: string;
}
