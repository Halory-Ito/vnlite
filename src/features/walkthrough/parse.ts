/**
 * 攻略 JSON 的解析（**纯函数**，不发请求）。
 *
 * ## 为什么不能直接 `as WalkthroughIndex`
 *
 * 攻略是**别人维护的 GitHub 仓库**里的静态 JSON，字段随时可能加减，类型也可能写错。
 * 直接断言的话，缺字段会在渲染时炸成 `undefined is not an object`，
 * 而且报错位置离真正的病因很远。这里把 `unknown` 收敛成 `types.ts` 的类型：
 *
 *   - **缺失 / 类型不对的标量** → 换成默认值
 *   - **缺失 / 类型不对的集合元素** → 整条丢掉（一个坏结局不该毁掉整篇攻略）
 *   - **未知枚举值** → 原样保留（结局类型、步骤类型都可能新增，见 types.ts 的警告）
 *
 * 全部导出以便 `scripts/smoke-api.ts` 直接断言，不用联网。
 */

import { ApiError } from "@/lib/api/errors";

import type {
  Walkthrough,
  WalkthroughEnding,
  WalkthroughIndex,
  WalkthroughIndexEntry,
  WalkthroughNames,
  WalkthroughRoute,
  WalkthroughStep,
} from "./types";

/* -------------------------------------------------------------------------- */
/* 取值助手                                                                    */
/* -------------------------------------------------------------------------- */

/** 非空字符串（仓库里多处出现「有值但全是空白」，trim 后当没有） */
function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function obj(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 多语言标题：只留非空的字符串项（键保留原样，取值时按偏好顺序挑） */
function names(value: unknown): WalkthroughNames {
  const record = obj(value);
  if (!record) return {};
  const out: WalkthroughNames = {};
  for (const [lang, raw] of Object.entries(record)) {
    const text = str(raw);
    if (text) out[lang] = text;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* 索引                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 解析索引里的一条。`vid` / `path` 缺失就没法定位文件，整条丢掉。
 *
 * 顺带把 `vid` 统一成小写 `v17` 形式 —— 查找时不做大小写假设（见`findEntry`）。
 */
function parseIndexEntry(raw: unknown): WalkthroughIndexEntry | null {
  const record = obj(raw);
  if (!record) return null;
  const vid = str(record.vid)?.toLowerCase();
  const path = str(record.path);
  if (!vid || !path) return null;

  return {
    vid,
    path,
    updatedAt: str(record.updatedAt) ?? "",
    routesCount: count(record.routesCount),
    endingsCount: count(record.endingsCount),
    stepsCount: count(record.stepsCount),
    name: names(record.name),
    level: count(record.level),
    author: str(record.author),
  };
}

/** 解析索引。结构完全不对（不是对象 / `walkthroughs` 不是数组）时抛错 */
export function parseWalkthroughIndex(raw: unknown): WalkthroughIndex {
  const record = obj(raw);
  if (!record) throw ApiError.parse("攻略索引不是一个对象");

  /*
   * ⚠️ 这里不能用 `list()`：空数组是合法的（索引刚生成、还没有任何攻略），
   * 但 `walkthroughs` 缺失或不是数组说明**拿到的根本不是索引文件**
   * （CDN 回了 HTML 错误页、被限流返回了对象）。两者必须分开 ——
   * 静默当成空索引，会把「取不到索引」说成「这部作品没有攻略」。
   */
  if (!Array.isArray(record.walkthroughs)) {
    throw ApiError.parse("攻略索引缺少 walkthroughs 数组");
  }

  const entries = record.walkthroughs.flatMap((item) => {
    const entry = parseIndexEntry(item);
    return entry ? [entry] : [];
  });

  return {
    schemaVersion: count(record.schemaVersion),
    // `count` 由仓库生成脚本写入，可能和实际条目数对不上 —— 对不上时以实际为准
    count: entries.length || count(record.count),
    latestUpdatedAt: str(record.latestUpdatedAt) ?? "",
    walkthroughs: entries,
  };
}

/* -------------------------------------------------------------------------- */
/* 单篇攻略                                                                    */
/* -------------------------------------------------------------------------- */

function parseStep(raw: unknown, index: number): WalkthroughStep | null {
  const record = obj(raw);
  if (!record) return null;
  // `content` 是空的步骤没有任何意义，直接丢
  const content = str(record.content);
  if (!content) return null;

  return {
    // id 只用来做 React key，缺失时用序号兜底（同一个结局内不会重复）
    id: str(record.id) ?? `step_${index}`,
    type: str(record.type) ?? "choice",
    content,
    subfix: str(record.subfix),
    prefix: str(record.prefix),
    group: str(record.group),
  };
}

function parseEnding(raw: unknown, index: number): WalkthroughEnding | null {
  const record = obj(raw);
  if (!record) return null;
  const name = str(record.name);
  if (!name) return null;

  return {
    id: str(record.id) ?? `ending_${index}`,
    name,
    type: str(record.type),
    requirements: str(record.requirements),
    steps: list(record.steps).flatMap((step, i) => {
      const parsed = parseStep(step, i);
      return parsed ? [parsed] : [];
    }),
  };
}

function parseRoute(raw: unknown, index: number): WalkthroughRoute | null {
  const record = obj(raw);
  if (!record) return null;
  const name = str(record.name);
  if (!name) return null;

  return {
    id: str(record.id) ?? `route_${index}`,
    name,
    description: str(record.description),
    endings: list(record.endings).flatMap((ending, i) => {
      const parsed = parseEnding(ending, i);
      return parsed ? [parsed] : [];
    }),
  };
}

/**
 * 解析单篇攻略。
 *
 * `fallbackVid`：解析不出 `vid` 时用它（调用方知道要取哪篇，比让 JSON 自己声明可靠）。
 * 线路全被丢弃时也返回这个结果 —— 由调用方渲染空态，而不是当成请求失败。
 */
export function parseWalkthrough(raw: unknown, fallbackVid: string): Walkthrough {
  const record = obj(raw);
  if (!record) throw ApiError.parse(`攻略 ${fallbackVid} 不是一个对象`);

  return {
    vid: str(record.vid)?.toLowerCase() ?? fallbackVid,
    name: names(record.name),
    level: count(record.level),
    updatedAt: str(record.updatedAt) ?? "",
    tips: list(record.tips).flatMap((tip) => {
      const text = str(tip);
      return text ? [text] : [];
    }),
    routes: list(record.routes).flatMap((route, i) => {
      const parsed = parseRoute(route, i);
      return parsed ? [parsed] : [];
    }),
  };
}
