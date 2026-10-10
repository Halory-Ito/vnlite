/**
 * 中文目录聚合（**源语言入口**）。
 *
 * 核心命名空间在 `zh.core.ts`；各 feature 在 `zh.<module>.ts`
 * （由各迁移批次填充）。这里只做合并 —— 键的权威定义永远在模块文件里。
 *
 * `TranslationKey`（`translate.ts`）由 `typeof zh` 派生，
 * 所以**模块文件没被这里 import 的键在 `t()` 里是编译错误**。
 */

import { zhBrowse } from "./browse";
import { zhCatalog } from "./catalog";
import { zhCore } from "./core";
import { zhDiscussion } from "./discussion";
import { zhEnums } from "./enums";
import { zhFavorite } from "./favorite";
import { zhHistory } from "./history";
import { zhMisc } from "./misc";
import { zhRecords } from "./records";
import { zhSearch } from "./search";
import { zhStats } from "./stats";
import { zhTimer } from "./timer";
import { zhUlist } from "./ulist";
import { zhUser } from "./user";
import { zhVn } from "./vn";
import { zhWalkthrough } from "./walkthrough";

export const zh = {
  ...zhCore,
  ...zhBrowse,
  ...zhSearch,
  ...zhUlist,
  ...zhVn,
  ...zhCatalog,
  ...zhUser,
  ...zhDiscussion,
  ...zhWalkthrough,
  ...zhTimer,
  ...zhRecords,
  ...zhHistory,
  ...zhFavorite,
  ...zhStats,
  enums: { ...zhEnums },
  ...zhMisc,
};
