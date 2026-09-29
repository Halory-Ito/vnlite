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

/** 客户端信息，用于 User-Agent（移动端 fetch 禁止自定义该头，仅存档） */
export const CLIENT_INFO = {
  name: "vnlite",
  version: "1.0.0",
} as const;

/** 语录「每日一条」的种子来源：用本地日期做确定性随机，同一天结果固定 */
export const QUOTE_OF_THE_DAY_SALT = "vnlite-quote";
