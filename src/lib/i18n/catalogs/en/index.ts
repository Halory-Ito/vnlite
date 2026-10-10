/**
 * 英文目录聚合（与 `zh.ts` 一一对应）。
 *
 * 每个模块文件用 `CatalogOf<typeof zhXxx>` 卡住结构：
 * 哪个模块漏键，错误就报在哪对文件上。
 */

import { enBrowse } from "./browse";
import { enCatalog } from "./catalog";
import { enCore } from "./core";
import { enDiscussion } from "./discussion";
import { enEnums } from "./enums";
import { enFavorite } from "./favorite";
import { enHistory } from "./history";
import { enMisc } from "./misc";
import { enRecords } from "./records";
import { enSearch } from "./search";
import { enStats } from "./stats";
import { enTimer } from "./timer";
import { enUlist } from "./ulist";
import { enUser } from "./user";
import { enVn } from "./vn";
import { enWalkthrough } from "./walkthrough";

export const en = {
  ...enCore,
  ...enBrowse,
  ...enSearch,
  ...enUlist,
  ...enVn,
  ...enCatalog,
  ...enUser,
  ...enDiscussion,
  ...enWalkthrough,
  ...enTimer,
  ...enRecords,
  ...enHistory,
  ...enFavorite,
  ...enStats,
  enums: { ...enEnums },
  ...enMisc,
};
