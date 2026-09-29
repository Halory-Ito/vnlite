/**
 * `lib/db` 统一出口。
 *
 * ⚠️ 按 C1 决策：这里只有**用户数据**。VNDB 业务数据不进库。
 */

export { getDatabase, wipeDatabase, SCHEMA_VERSION } from "./schema";
export * as ulistDao from "./dao/ulist";
export * as accountDao from "./dao/account";
