/**
 * 攻略数据类型（对应 `vnlite-walkthrough-and-guide` 仓库的 JSON 结构）。
 *
 * ## 这套类型是「解析后的结果」，不是 JSON 的原样镜像
 *
 * 攻略来自**别人维护的 GitHub 仓库**，字段随时可能加减、类型也可能写错。
 * 所以网络层拿到的 `unknown` 一律经`features/walkthrough/parse` 收敛成这里的类型：
 * 缺字段走默认值、类型不对丢弃、脏条目直接扔掉。
 * 组件因此可以假定数据一定是合法的 —— 解析规则见那个文件。
 *
 * ⚠️ 未知枚举**不丢弃，只降级**：结局的 `type` 与步骤的 `type` 都可能冒出新值，
 * 丢掉等于让攻略凭空少一段。解析后保留原字符串，展示层再查表（查不到就不显示徽标）。
 */

/** 作品标题的多语言写法（仓库里出现过 `zh-cn` / `en-us` / `ja-jp` / `ja-Latn` / `ja`） */
export type WalkthroughNames = Record<string, string>;

/** 索引里的一条（`index.json` 的 `walkthroughs[]`） */
export interface WalkthroughIndexEntry {
  /** VNDB 的作品 id，形如 `v4`（注意**不带** `v` 的路由写法，索引里就是 `v4`） */
  vid: string;
  /** 仓库内相对路径，如 `walkthroughs/1-10000/1-1000/1-100/v4.json` */
  path: string;
  /** `YYYY-MM-DD` */
  updatedAt: string;
  routesCount: number;
  endingsCount: number;
  stepsCount: number;
  name: WalkthroughNames;
  /**
   * 详细程度：1 = 详细（含 flag / 条件），2 = 简略（只列流程）。
   * 仓库里出现过 0（未知），展示层不认就别显示。
   */
  level: number;
  author?: string;
}

export interface WalkthroughIndex {
  schemaVersion: number;
  count: number;
  /** 索引里最新的更新时间，`YYYY-MM-DD` */
  latestUpdatedAt: string;
  walkthroughs: WalkthroughIndexEntry[];
}

/* -------------------------------------------------------------------------- */
/* 单篇攻略                                */
/* -------------------------------------------------------------------------- */

/**
 * 步骤类型。
 *
 * `choice` 选这项 —— 攻略的主体
 * `save` / `load` 存档 / 读档 —— `content` 是存档位（`SAVE 1`），`subfix` 是备注（`初期`）
 * `note` 备注 —— 作者插的说明（常见于「多周目后才会出现」）
 */
export type WalkthroughStepType = "choice" | "save" | "load" | "note";

export interface WalkthroughStep {
  id: string;
  type: WalkthroughStepType | string;
  content: string;
  /** 存档备注，如「初期」「第三章」 */
  subfix?: string;
  /** 前缀标记，如「★」 */
  prefix?: string;
  /** 章节名，同名连续步骤会归成一段（常见「第一章 樱岛篇」） */
  group?: string;
}

export type WalkthroughEndingType = "true" | "good" | "normal" | "bad";

export interface WalkthroughEnding {
  id: string;
  name: string;
  type?: WalkthroughEndingType | string;
  /** 达成条件（「打通礼奈全部 flag…」） */
  requirements?: string;
  steps?: WalkthroughStep[];
}

export interface WalkthroughRoute {
  id: string;
  name: string;
  description?: string;
  endings: WalkthroughEnding[];
}

export interface Walkthrough {
  vid: string;
  name: WalkthroughNames;
  level: number;
  updatedAt: string;
  /** 作者写的提示，常见是剧透警告 */
  tips?: string[];
  routes: WalkthroughRoute[];
}
