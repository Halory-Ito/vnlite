# i18n 迁移指南（各批次共用）

> 面向「把剩余页面文案迁移到 i18n」的执行者（人或 agent）。
> 基础设施见 `src/lib/i18n/`，进度清单见 `plan.md` Module 8。

## 基础设施速查

| 场景                | 用法                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| 组件内              | `const { t } = useTranslation()`（`@/hooks/use-translation`），`t("ns.key")` |
| 纯函数 / 模块级代码 | `import { t } from "@/lib/i18n/translate"`，直接调用                         |
| 带参数              | `t("ns.key", { name: value })`，目录里写 `%{name}`                           |
| 类型                | `import type { TranslationKey } from "@/lib/i18n/translate"`                 |

**模块级常量不能存文案**：存 `TranslationKey`（渲染时 `t(key)`）或存枚举值（渲染时翻译）。

## 目录文件（每个批次只改自己那两份）

目录结构：`src/lib/i18n/catalogs/<lang>/`，每种语言一个文件夹，入口是其 `index.ts`
（聚合该语言所有模块并导出 `zh` / `en`）。

- `src/lib/i18n/catalogs/zh/<mod>.ts` —— 权威目录：`export const zh<Name> = { <ns>: {…} } as const;`
- `src/lib/i18n/catalogs/en/<mod>.ts` —— 英文镜像：`export const en<Name>: CatalogOf<typeof zh<Name>> = {…};`
  （`CatalogOf` 从 `../catalog-types` 引入，会卡住漏键 / 多键，编译期报错）
- **不要动** `zh/index.ts` / `en/index.ts` / `zh/core.ts` / `en/core.ts` / 其它模块文件。
- 顶层只能有你这一个命名空间；键名小驼峰、语义化（`browse.filter.title`）。
- 中文文案保持现有语义；**英文必须与 vndb.org 官网用词一致**。

## 现有通用键（`common.*`）

`back` / `close` / `cancel` / `confirm` / `clear` / `retry` / `loading` / `errorTitle` /
`errorFallback` / `unknownError` / `finish` / `apply` / `reset` / `save` / `edit` /
`remove` / `add` / `search` / `all` / `none` / `noData` / `failed`

## 枚举与格式化（不要直接引 `lib/api/enums` 的 `*_LABEL`）

`utils/format`：`platformLabel` / `platformListLabel` / `sexLabel` / `staffRoleLabel` /
`devStatusLabel` / `voicedLabel` / `relationLabel` / `producerTypeLabel` /
`characterRoleLabel` / `languageLabel` / `formatReleased` / `formatLength` /
`formatMinutes` / `formatRelativeDays` / `formatRelativeTime` / `formatMonthDay` /
`formatCount` / `formatRating`。

## vndb.org 术语表（英文必须用这些）

- 作品 Visual novel(s)（简写 VN）、浏览 Browse、搜索 Search、清单 My List、
  愿望单 Wishlist、Playing / Finished / Stalled / Dropped / Voted / No label（内置标签保持英文）
- 发行版 Releases、厂商 Producers、制作人员 Staff、角色 Characters、标签 Tags、特性 Traits
- 评价 Reviews、语录 Quotes、讨论 Discussions、外链 Links、关联 Relations、截图 Screenshots
- 概览 Info、时长 Play time、Developer、Publishers、Rating、Vote count、Popularity、
  Released、Original language / Available languages、Platforms、Development status、Age rating
- 角色定位：Protagonist / Main character / Side character / Appears
- 关系：Sequel / Prequel / Same series / Alternative version / Shares characters /
  Same setting / Side story
- 制作者类型：Company / Individual / Amateur group
- 配音：Unknown / Not voiced / Only ero scenes voiced / Partially voiced / Fully voiced
- NSFW：Hide / Blur / Show
- 常用按钮：Add to list / Remove / Edit / Save / Apply / Reset / Clear
- 专有名词保持原样：VNDB、Kana API、Token、鲲 Galgame、GitHub、Twitter…

## 硬性要求

1. 只改指定文件；行为等价（只换文案来源，不改逻辑 / 样式 / 布局 / 参数）。
2. **不要跑仓库级** `bun run format`（并行批次会互相踩）；用 `bunx oxfmt <你的文件>`。
3. 并行期间其他模块可能是中间态：`bun run typecheck` 只过滤你自己路径的错误。
4. 用 `bunx oxlint <你的文件/目录>` 自检。
5. `accessibilityLabel` / `accessibilityHint` / `placeholder` / 空态 / 错误提示 /
   toast / 通知文案都算用户可见文案。
6. 注释保持中文，不翻译注释；VNDB 的数据（标签名、作品名、用户名、清单标签）不翻译。
