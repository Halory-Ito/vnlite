/**
 * 目录结构工具。
 *
 * `zh.*.ts` 是各模块的**权威目录**（`as const` 字面量）；
 * 对应的 `en.*.ts` 用 `CatalogOf<typeof zhXxx>` 卡住结构 ——
 * 漏键 / 多键都会编译报错。
 */

/** 把字面量类型放宽成 `string`（嵌套结构原样保留） */
export type Loose<T> = { [K in keyof T]: T[K] extends string ? string : Loose<T[K]> };

/** 英文目录必须满足这个结构 */
export type CatalogOf<T> = Loose<T>;
