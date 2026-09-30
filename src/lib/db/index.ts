/**
 * `lib/db` 统一出口。
 *
 * ⚠️ 2026-09-30 架构调整后：**清单数据不落本地库**（VNDB 直读直写），
 * 这里只剩 `account`（用户信息）与迁移工具。
 */

export { getDatabase, setDatabaseProvider, wipeDatabase, SCHEMA_VERSION } from "./schema";
export type { SqlDatabase, SqlRunResult } from "./schema";
export * as accountDao from "./dao/account";
