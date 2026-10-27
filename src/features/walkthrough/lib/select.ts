/**
 * 攻略的展示层映射（**纯函数**）：枚举 → 文案 / 配色 / 图标，以及步骤分段。
 *
 * 都放在这里是惯例（见 `utils/format`、`lib/api/enums`）：文案与视觉决策集中一处，
 * 组件里不散落 `switch`，冒烟测试也能直接断言。
 *
 * ⚠️ 模块级常量不存文案：结局 / 步骤类型只存 `TranslationKey`，
 * 由调用方在渲染期 `t(...)`（`endingMeta` 例外，它自己查表，见下）。
 */

import type { IconName } from "@/components/icon";
import { t, type TranslationKey } from "@/lib/i18n/translate";

import type { WalkthroughMarks } from "./marks";
import type {
  Walkthrough,
  WalkthroughEnding,
  WalkthroughEndingType,
  WalkthroughIndex,
  WalkthroughIndexEntry,
  WalkthroughStep,
  WalkthroughStepType,
} from "./types";

/* -------------------------------------------------------------------------- */
/* 查找                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 从索引里找某个作品（VNDB 的 id 形如 `v17`）。
 *
 * 比较前统一小写：路由参数与索引理论上都是小写，但手输 / 跳转参数不该让它静默查不到。
 */
export function findEntry(
  index: WalkthroughIndex | undefined,
  vnId: string
): WalkthroughIndexEntry | undefined {
  if (!index || !vnId) return undefined;
  const target = vnId.toLowerCase();
  return index.walkthroughs.find((entry) => entry.vid === target);
}

/* -------------------------------------------------------------------------- */
/* 结局类型                                                                    */
/* -------------------------------------------------------------------------- */

/** HeroUI `Chip` 的语义色 */
export type Tone = "accent" | "success" | "default" | "danger";

export interface EndingMeta {
  label: string;
  tone: Tone;
}

/**
 * 结局类型的文案与配色。
 *
 * 仓库里实际出现 `true` / `good` / `normal` / `bad` 四种（另有未知值时的兜底）。
 * 排序按「好结局在前」不太可靠（作者给的顺序往往就是游玩顺序），所以保持原序展示。
 */
interface EndingMetaDef {
  labelKey: TranslationKey;
  tone: Tone;
}

const ENDING_META: Record<WalkthroughEndingType, EndingMetaDef> = {
  true: { labelKey: "walkthrough.ending.true", tone: "accent" },
  good: { labelKey: "walkthrough.ending.good", tone: "success" },
  normal: { labelKey: "walkthrough.ending.normal", tone: "default" },
  bad: { labelKey: "walkthrough.ending.bad", tone: "danger" },
};

const UNKNOWN_ENDING: EndingMeta = { label: "", tone: "default" };

/**
 * 查不到就返回空 label —— 调用方据此**不挂徽标**，而不是显示原始英文枚举。
 *
 * 这里是纯函数映射（语言切换由调用方重渲染触发），所以直接用全局 `t` 取文案，
 * 与 `utils/format` 同一套约定。
 */
export function endingMeta(type: WalkthroughEndingType | string | undefined): EndingMeta {
  const meta = type ? ENDING_META[type as WalkthroughEndingType] : undefined;
  if (!meta) return UNKNOWN_ENDING;
  return { label: t(meta.labelKey), tone: meta.tone };
}

/* -------------------------------------------------------------------------- */
/* 步骤类型                                                                    */
/* -------------------------------------------------------------------------- */

export interface StepMeta {
  /** 图标（Gravity UI） */
  icon: IconName;
  /**
   * 行首小标签的键（`choice` 是最常见的形态，不加标签免得满屏都是字）；
   * 渲染期 `t(labelKey)`，`null` 表示不挂标签。
   */
  labelKey: TranslationKey | null;
  /** 主题语义色，用于图标 */
  tone: Tone;
}

/**
 * 步骤类型的视觉映射。
 *
 * `choice` 用对勾：攻略里绝大多数步骤就是「选这个」，对勾比箭头更明确；
 * 存档 / 读档用软盘与回转箭头 —— 这两个必须一眼可辨，错了会毁掉一整周目。
 */
const STEP_META: Record<WalkthroughStepType, StepMeta> = {
  choice: { icon: "check", labelKey: null, tone: "default" },
  save: { icon: "floppyDisk", labelKey: "walkthrough.step.save", tone: "accent" },
  load: { icon: "arrowRotateLeft", labelKey: "walkthrough.step.load", tone: "accent" },
  note: { icon: "circleInfo", labelKey: "walkthrough.step.note", tone: "default" },
};

const UNKNOWN_STEP: StepMeta = { icon: "check", labelKey: null, tone: "default" };

export function stepMeta(type: WalkthroughStepType | string): StepMeta {
  return STEP_META[type as WalkthroughStepType] ?? UNKNOWN_STEP;
}

/* -------------------------------------------------------------------------- */
/* 详细程度                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `level` 的文案：1 = 详细（带 flag / 达成条件），2 = 简略。
 *
 * 0 是仓库里的「未标注」，不显示 —— 猜一个文案不如不显示。
 */
export function levelLabel(level: number): string {
  if (level === 1) return t("walkthrough.level.detailed");
  if (level === 2) return t("walkthrough.level.brief");
  return "";
}

/* -------------------------------------------------------------------------- */
/* 步骤分段                                                                    */
/* -------------------------------------------------------------------------- */

export interface StepGroup {
  /** 章节名；没有 `group` 的连续步骤归到 `""` 段 */
  title: string;
  /**
   * React key —— 取**该段第一个步骤的 id**。
   *
   * 章节名不能当 key：`""` 是最常见的标题（无章节的攻略整份都是它），
   * 拿它做 key 会让所有段共用同一个 key。
   */
  key: string;
  steps: WalkthroughStep[];
}

/**
 * 按 `group` 把步骤分段。
 *
 * 仓库里同一章节的每一步都重复带着 `group`（冗余但便于编辑），这里压成一段一个标题。
 * 标题中途变化就切新段 —— **没有 `group` 的连续步骤会合成同一段**（标题为空）。
 * 这正是想要的：它们本来就是一组平铺步骤，合成一段后渲染上是一串连续的行，
 * 不画标题行；拆成多段反而多出几个空 `View`。
 *
 * ⚠️ 空 `group`（作者显式给了 `""`）与「没有 group」无法区分，统一按空标题处理。
 */
export function groupSteps(steps: readonly WalkthroughStep[]): StepGroup[] {
  const groups: StepGroup[] = [];
  for (const step of steps) {
    const title = step.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.steps.push(step);
    else groups.push({ title, key: step.id, steps: [step] });
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/* 统计                                                                        */
/* -------------------------------------------------------------------------- */

export interface WalkthroughStats {
  routes: number;
  endings: number;
  steps: number;
}

/**
 * 实际数一遍（不信任索引里的 `*Count`）。
 *
 * 索引的统计由仓库生成脚本写入，与正文不一致的情况真实存在（作者改完正文忘了重跑生成）；
 * 页签上展示的数字必须和下面列出来的条目对得上。
 */
export function countStats(walkthrough: Walkthrough): WalkthroughStats {
  let endings = 0;
  let steps = 0;
  for (const route of walkthrough.routes) {
    endings += route.endings.length;
    for (const ending of route.endings) steps += ending.steps?.length ?? 0;
  }
  return { routes: walkthrough.routes.length, endings, steps };
}

/** 结局有没有可展开的步骤（没有就别做成可点的行） */
export function hasSteps(ending: WalkthroughEnding): boolean {
  return (ending.steps?.length ?? 0) > 0;
}

/* -------------------------------------------------------------------------- */
/* 标记进度                                                                    */
/* -------------------------------------------------------------------------- */

export interface MarkProgress {
  /** 已标记「已走过」的步骤数 */
  doneSteps: number;
  /** 全部步骤数 */
  totalSteps: number;
  /** 已标记「重点」的步骤数 */
  starredSteps: number;
  /** 已标记「已达成」的结局数 */
  achievedEndings: number;
  /** 全部结局数 */
  totalEndings: number;
}

/**
 * 进度 = 「命中数 / 总数」，总数一律**现算**。
 *
 * 攻略更新后步骤会增减，用上次的总数会算出超过 100% 的进度。
 * 孤立标记（作者重排步骤导致 id 消失的）不计入分子 —— 计入的话数字会虚高。
 */
export function markProgress(walkthrough: Walkthrough, marks: WalkthroughMarks): MarkProgress {
  let totalSteps = 0;
  let totalEndings = 0;
  let doneSteps = 0;
  let starredSteps = 0;
  let achievedEndings = 0;

  for (const route of walkthrough.routes) {
    for (const ending of route.endings) {
      totalEndings += 1;
      if (marks.endings.includes(ending.id)) achievedEndings += 1;

      for (const step of ending.steps ?? []) {
        totalSteps += 1;
        const mark = marks.steps[step.id];
        if (mark?.done) doneSteps += 1;
        if (mark?.starred) starredSteps += 1;
      }
    }
  }

  return { doneSteps, totalSteps, starredSteps, achievedEndings, totalEndings };
}

/* -------------------------------------------------------------------------- */
/* 剧透打码                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 按**等长**替换成圆点：空白原样保留，其余全换成 `•`。
 *
 * 为什么等长而不是盖一层遮罩：遮罩揭开的那一瞬间行高 / 换行位置全变，
 * 一行塌成三行，整个列表往下跳，用户刚点开就被甩出去。
 * 圆点保留字符数，揭开前后排版基本一致（中日文与圆点宽度略有差异，但不会整行塌）。
 *
 * 空白必须保留 —— 攻略靠缩进与断句表达步骤序列，一并打掉就读不成句。
 *
 * 住在 `select.ts` 而不是组件里：`scripts/smoke-api.ts` 只 import 纯 `.ts` 模块，
 * 从 `.tsx` 引会把 `react-native` 一起拖进 Node 环境。
 */
export function maskText(text: string): string {
  return [...text].map((char) => (/\s/.test(char) ? char : "•")).join("");
}
