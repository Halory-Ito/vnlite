/**
 * 主题的**纯逻辑**部分：品牌色 → HeroUI token 的派生。
 *
 * 刻意与 `themes.ts`（含 `require()` 图片资源）分开：
 * 资源那层 Metro 才能处理，纯 JS 在 bun/tsc 跑不了二进制；
 * 这样派生逻辑可以单独验证（见 `scripts/smoke-theme.ts`）。
 *
 * ## 设计要点：主题 ≠ 明暗模式
 *
 * 主题只提供**品牌色 + 背景图**（色彩身份），明暗模式由用户的 `colorScheme`
 * 偏好决定。也就是说**每一套主题都必须同时能用在亮色和暗色下** ——
 * 不允许「这套主题只能暗色用」。
 *
 * 所以 `deriveTokens` 的第二个参数是 `mode` 而不是主题自带的亮度：
 * 同一套品牌色，在 light / dark 下各派生一遍，两套结果都必须通过对比度断言。
 */

import {
  BLACK,
  CONTRAST_AA,
  CONTRAST_MUTED,
  WHITE,
  bestTextOn,
  contrastRatio,
  ensureContrast,
  mix,
  parseColor,
  quantize,
  toHex,
  type Rgb,
} from "./color";

/** 选中态文字与未选中态（`muted`）之间至少要拉开的对比度（不是可读性，是「看得出区别」） */
const SEGMENT_FG_DISTINCT = 1.5;

/** 选中块从 `--default` 往 `accent` 混的比例上限：越大越显眼 */
const SEGMENT_MIX_MAX = 0.3;
/** 退让下限：再低就和列表底分不出来了 */
const SEGMENT_MIX_MIN = 0.15;
const SEGMENT_MIX_STEP = 0.025;

/**
 * 选中块（Tabs / 分段控件的指示块）及其文字。
 *
 * 为什么不是固定一个混色比例：`accent` 的明度随主题差很多
 * （Seinarukana 暗色的 accent 接近纯白），固定 30% 会把暗色主题的选中块
 * 一路推亮到「配黑字白字都不达标」的中间地带。
 * 所以从 30% 往下试，取第一个三边都达标的比例：
 *   1. 文字压在选中块上 ≥ AA
 *   2. 文字落在列表底（`--default`）上 ≥ AA（指示块动画期间会出现这一幕）
 *   3. 文字与未选中态（`--muted`）拉得开 —— 否则「选中 / 未选中」只差底色，
 *      几套灰调主题下两者会算成同一个颜色（Gekkou No Carnevale 暗色曾都是 #848484）
 */
function deriveSegment(
  defaultSurface: Rgb,
  accent: Rgb,
  muted: Rgb,
  darken: boolean
): { segment: Rgb; segmentForeground: Rgb } {
  for (let t = SEGMENT_MIX_MAX; t >= SEGMENT_MIX_MIN - 1e-9; t -= SEGMENT_MIX_STEP) {
    const segment = quantize(mix(defaultSurface, accent, t));
    const foreground = deriveSegmentForeground(accent, segment, muted, defaultSurface, darken);
    if (foreground) return { segment, segmentForeground: foreground };
  }

  // 理论上到不了这里（最低比例总能配出可读色），真到了就用最保守的一版
  const segment = quantize(mix(defaultSurface, accent, SEGMENT_MIX_MIN));
  return { segment, segmentForeground: ensureContrast(accent, segment, CONTRAST_AA, darken) };
}

/**
 * 选中态文字颜色。
 *
 * 三步走（任何一步不成立就返回 `null`，交给 `deriveSegment` 换个混色比例）：
 *   1. 先按 AA 反解出压在选中块上能看清的色
 *   2. 如果它和 `muted` 太像，就往同方向推远一点
 *   3. 推远后可能丢了对比度，这时用「选中块上的中性极值」兜底
 */
function deriveSegmentForeground(
  accent: Rgb,
  segment: Rgb,
  muted: Rgb,
  listBackground: Rgb,
  darken: boolean
): Rgb | null {
  let color = ensureContrast(accent, segment, CONTRAST_AA, darken);
  if (contrastRatio(color, muted) < SEGMENT_FG_DISTINCT) {
    color = ensureContrast(color, muted, SEGMENT_FG_DISTINCT, darken);
  }
  if (contrastRatio(color, segment) < CONTRAST_AA) {
    color = bestTextOn(segment);
  }

  const readableOnBoth =
    contrastRatio(color, segment) >= CONTRAST_AA &&
    contrastRatio(color, listBackground) >= CONTRAST_AA;
  if (!readableOnBoth) return null;
  if (contrastRatio(color, muted) < SEGMENT_FG_DISTINCT) return null;
  return color;
}

/** 明暗模式。与 `Preferences.colorScheme` 去掉 `"system"` 之后的值一致 */
export type ThemeMode = "light" | "dark";

/** 全部模式，遍历用（冒烟测试给每套主题跑两遍就靠它） */
export const MODES: readonly ThemeMode[] = ["light", "dark"] as const;

export interface ThemeSeed {
  id: string;
  name: string;
  /**
   * 品牌主色。
   *
   * ⚠️ 主题**不自带**明暗属性 —— 每一套主题都要能同时用于亮色和暗色模式，
   * 用哪个由用户的 `colorScheme` 偏好决定（见 `themes.ts#resolveMode`）。
   * 「好不好看」交给 `deriveTokens` 的可读性钳制 + 冒烟测试的对比度断言保证。
   */
  primary: string;
  /** 品牌辅色 */
  secondary: string;
  /** 背景图文件名（不含扩展名），对应 assets/images/themes/ */
  image: string;
}

/**
 * 11 套主题的色值。
 *
 * 取自 vndb-lite 的 `ThemeCode` 枚举（Apache-2.0），
 * 主题名与主/辅色与原项目一致。
 */
export const THEME_SEEDS: ThemeSeed[] = [
  { id: "agl", name: "Angel Serenade", primary: "#325064", secondary: "#8CDCFF", image: "agl" },
  { id: "air", name: "AIR", primary: "#B4DCFF", secondary: "#5082E1", image: "air" },
  { id: "ev17", name: "Ever17", primary: "#6EC8D2", secondary: "#F0AA64", image: "ev17" },
  {
    id: "fate",
    name: "Fate / Stay Night",
    primary: "#463232",
    secondary: "#D26446",
    image: "fate",
  },
  {
    id: "carnvl",
    name: "Gekkou No Carnevale",
    primary: "#141414",
    secondary: "#BEBEBE",
    image: "carnvl",
  },
  { id: "hgrshi", name: "Higurashi", primary: "#F5B4AF", secondary: "#DCDCDC", image: "hgrshi" },
  { id: "tsukhme", name: "Tsukihime", primary: "#645050", secondary: "#FA4646", image: "tsukhme" },
  { id: "toho", name: "Touhou", primary: "#AFAFAF", secondary: "#DCD7D7", image: "toho" },
  {
    id: "seinrkn",
    name: "Seinarukana",
    primary: "#FFF0F0",
    secondary: "#FF4696",
    image: "seinrkn",
  },
  {
    id: "lilbusts",
    name: "Little Busters!",
    primary: "#FAC8FA",
    secondary: "#F050D7",
    image: "lilbusts",
  },
  { id: "saya", name: "Saya No Uta", primary: "#326450", secondary: "#F0B48C", image: "saya" },
];

/**
 * 从主/辅色推导出 HeroUI 需要的一整套 token。
 *
 * ## 核心原则：对比度**由构造保证**，不是靠调参碰运气
 *
 * 老实现用固定比例混色猜前景色（`mix(primary, BLACK, 0.25)`），
 * 固定比例保证不了对比度 —— Higurashi 在白底上只有 2.99:1，
 * Seinarukana 卡在 4.48:1。现在一律走 `ensureContrast`：
 * 先看够不够，不够就二分反解出「刚好达标」的最小修改量。
 *
 * 而且**每套主题都要同时支持亮色和暗色** —— 品牌色只提供色彩身份，
 * 明暗由用户偏好决定，所以同一组主/辅色要在两种模式下各派生一遍并都达标。
 *
 * 状态色（success/warning/danger）不覆盖 —— 它们是语义色，
 * 跟着品牌色走会失去「警告=橙、错误=红」的共识。
 *
 * @param mode 明暗模式。**不是主题属性**，由用户偏好决定
 */
export function deriveTokens(
  primaryHex: string,
  secondaryHex: string,
  mode: ThemeMode
): Record<string, string> {
  const primaryRaw = parseColor(primaryHex);
  const secondaryRaw = parseColor(secondaryHex);
  const dark = mode === "dark";

  const base = dark ? BLACK : WHITE;
  /*
   * 所有参与对比度计算的底色都要先 `quantize` 成最终 hex 精度，
   * 否则会出现「用未取整的中间值判定达标，实际写进 token 的取整值差一点」
   * —— 冒烟测试抓到过 4.49:1 < 4.5 这种。
   */
  const background = quantize(mix(base, primaryRaw, dark ? 0.08 : 0.05));

  /*
   * Surface 家族。`--surface-tertiary` 是**离底色最远**的一层
   * （浅色模式下更深、深色模式下更亮），所以前景色只要能在它上面看清，
   * 就能在 background / surface / surface-secondary 上同样看清。
   * 下面的 `ensureContrast` 一律以它为基准反解，省掉逐层校验。
   */
  const surface = quantize(mix(base, primaryRaw, dark ? 0.16 : 0.07));
  const surfaceSecondary = quantize(mix(base, primaryRaw, dark ? 0.23 : 0.12));
  const surfaceTertiary = quantize(mix(base, primaryRaw, dark ? 0.3 : 0.18));

  // 前景色：先取一个带主题味道的起点，再按对比度反解
  const foregroundSeed = dark ? mix(primaryRaw, secondaryRaw, 0.35) : mix(primaryRaw, BLACK, 0.25);
  const foreground = ensureContrast(foregroundSeed, surfaceTertiary, CONTRAST_AA, !dark);

  // accent：要能在页面/卡片底色上作为文字用（链接、选中态文字）
  const accent = ensureContrast(primaryRaw, surfaceTertiary, CONTRAST_AA, !dark);
  const accentForeground = bestTextOn(accent);

  const muted = ensureContrast(
    dark
      ? mix({ r: 180, g: 180, b: 180 }, primaryRaw, 0.3)
      : mix({ r: 110, g: 110, b: 110 }, primaryRaw, 0.25),
    background,
    CONTRAST_MUTED,
    !dark
  );

  /*
   * `--segment` 是分段控件 / `Tabs` 的**选中态指示块**底色，
   * `--segment-foreground` 是它上面的文字（推导见 `deriveSegment`）。
   *
   * 曾经把 segment 取成「底色 + 一点点 primary」→ 亮色模式下算出 #f2f2f2，
   * 和 `--default`（列表底）几乎同色，看起来「选中态没有背景」。
   * 后来固定混 20%，暗色主题下色差只有 22 左右，仍然要眯眼才看得见；
   * 现在从 30% 起步（按需退让），最小色差 33。
   *
   * ⚠️ 为什么不能靠「调亮度」来拉开差距：
   * 中间亮度的底（相对亮度 ~0.2）**无论配黑字还是白字都到不了 4.5:1**
   * （数学上做不到）。所以选中块必须留在「偏暗配亮字」或「偏亮配暗字」
   * 的安全区里，色差只能靠**色相/饱和度**来给。
   */
  const defaultSurface = quantize(mix(base, primaryRaw, dark ? 0.28 : 0.14));
  const { segment, segmentForeground } = deriveSegment(defaultSurface, accent, muted, !dark);

  return {
    // 基础
    "--background": toHex(background),
    "--foreground": toHex(foreground),
    // Surface（卡片等非浮层容器）
    "--surface": toHex(surface),
    "--surface-foreground": toHex(foreground),
    "--surface-secondary": toHex(surfaceSecondary),
    "--surface-secondary-foreground": toHex(foreground),
    "--surface-tertiary": toHex(surfaceTertiary),
    "--surface-tertiary-foreground": toHex(foreground),
    // Overlay（弹窗 / 菜单 / 浮层）
    "--overlay": toHex(surface),
    "--overlay-foreground": toHex(foreground),
    "--backdrop": toHex(BLACK),
    // 次要文字
    "--muted": toHex(muted),
    // 默认按钮 / Chip
    "--default": toHex(defaultSurface),
    "--default-foreground": toHex(foreground),
    // 强调色
    "--accent": toHex(accent),
    "--accent-foreground": toHex(accentForeground),
    // 分段控件 / Tabs 选中态
    "--segment": toHex(segment),
    "--segment-foreground": toHex(segmentForeground),
    // 输入框
    "--field-background": toHex(surface),
    "--field-foreground": toHex(foreground),
    "--field-placeholder": toHex(muted),
    "--field-border": toHex(quantize(mix(base, primaryRaw, dark ? 0.35 : 0.25))),
    // 描边 / 分隔线
    "--border": toHex(quantize(mix(base, primaryRaw, dark ? 0.35 : 0.24))),
    "--separator": toHex(quantize(mix(base, primaryRaw, dark ? 0.28 : 0.16))),
    // 焦点环 / 链接
    "--focus": toHex(accent),
    "--link": toHex(accent),
  };
}

/** HeroUI 默认可覆盖的原始变量名清单（照抄 variables.css，改名时以那个文件为准） */
export const OVERRIDABLE_TOKENS = [
  "--background",
  "--foreground",
  "--surface",
  "--surface-foreground",
  "--surface-secondary",
  "--surface-secondary-foreground",
  "--surface-tertiary",
  "--surface-tertiary-foreground",
  "--overlay",
  "--overlay-foreground",
  "--backdrop",
  "--muted",
  "--default",
  "--default-foreground",
  "--accent",
  "--accent-foreground",
  "--segment",
  "--segment-foreground",
  "--field-background",
  "--field-foreground",
  "--field-placeholder",
  "--field-border",
  "--border",
  "--separator",
  "--focus",
  "--link",
] as const;
