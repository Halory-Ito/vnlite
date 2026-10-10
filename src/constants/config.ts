/**
 * 全局常量与配置。
 */

/** 正式环境 API 根地址 */
export const API_BASE_URL = "https://api.vndb.org/kana";

/** 测试环境（beta），仅在开发调试时手动切换 */
export const API_BASE_URL_BETA = "https://beta.vndb.org/api/kana";

/**
 * VNDB 速率限制：每 5 分钟 200 次请求。
 * 见 https://api.vndb.org/kana#rate-limiting
 */
export const RATE_LIMIT = {
  /** 窗口内允许的最大请求数 */
  max: 200,
  /** 窗口长度（毫秒） */
  windowMs: 5 * 60 * 1000,
  /** 单请求超过该毫秒数会被服务端中止，客户端需更早放弃 */
  requestTimeoutMs: 3000,
  /** 429 后指数退避的起始延迟 */
  retryBaseDelayMs: 1000,
  /** 429 后指数退避的最大延迟 */
  retryMaxDelayMs: 60_000,
  /** 单个请求的最大重试次数 */
  maxRetries: 3,
} as const;

/** 单次查询 `results` 上限；超过会被服务端拒绝 */
export const MAX_RESULTS_PER_PAGE = 100;

/** Kana API 无字段通配符，列表/详情必须显式列字段 */
export const FIELD_SEP = ",";

/** 用户去 vndb.org 创建 token 的地址（设置页引导用） */
export const TOKEN_CREATE_URL = "https://vndb.org/u/tokens";

/** VNDB 网站根地址（讨论模块抓取 HTML 用；Kana API 不提供讨论数据） */
export const VNDB_WEB_BASE = "https://vndb.org";

/* -------------------------------------------------------------------------- */
/* 攻略数据源                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 攻略仓库（VN 详情页「攻略」页签的数据来源）。
 *
 * Kana API 没有任何攻略端点，所以攻略来自这个独立的 GitHub 仓库 ——
 * 纯静态 JSON，`index.json` 是索引（vid → 文件路径 + 统计），单篇攻略按 vid 单独一个文件。
 */
export const WALKTHROUGH_REPO_URL = "https://github.com/Halory-Ito/vnlite-walkthrough-and-guide";

/** 索引文件路径（相对仓库根） */
export const WALKTHROUGH_INDEX_PATH = "index.json";

/**
 * 取文件的源，**按顺序重试**。
 *
 * 1. GitHub 原始文件：权威，但国内直连经常超时
 * 2. jsDelivr 镜像：国内可用性好、响应快，且带 `Access-Control-Allow-Origin: *`
 *
 * 两者内容同源（都指向 main 分支），所以谁先通用谁；全失败才算请求失败。
 * 攻略页签本身对延迟敏感 —— 单个源挂住时不该让用户干等，客户端超时要短（见
 * `features/walkthrough/client.ts`）。
 */
export const WALKTHROUGH_SOURCES = [
  "https://raw.githubusercontent.com/Halory-Ito/vnlite-walkthrough-and-guide/main",
  "https://cdn.jsdelivr.net/gh/Halory-Ito/vnlite-walkthrough-and-guide@main",
] as const;

/** 客户端信息，用于 User-Agent（移动端 fetch 禁止自定义该头，仅存档） */
export const CLIENT_INFO = {
  name: "vnlite",
  version: "1.3.0",
} as const;

/**
 * 开发者与仓库信息（「关于」页用）。
 *
 * `repo` 同时是「检查更新」查询 GitHub 的标识，别只改一个。
 */
export const DEVELOPER_INFO = {
  name: "Halory",
  github: "https://github.com/Halory-Ito",
  repo: "Halory-Ito/vnlite",
  issues: "https://github.com/Halory-Ito/vnlite/issues",
  walkthroughRepo: "https://github.com/Halory-Ito/vnlite-walkthrough-and-guide",
} as const;

/** 语录「每日一条」的种子来源：用本地日期做确定性随机，同一天结果固定 */
export const QUOTE_OF_THE_DAY_SALT = "vnlite-quote";
