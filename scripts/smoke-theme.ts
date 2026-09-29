/**
 * 主题派生逻辑的校验。
 *
 *   bun run scripts/smoke-theme.ts
 *
 * 单独拆一个脚本的原因：`themes.ts` 里有 `require()` 二进制图片，
 * Metro 之外的环境（bun / tsc）跑不了。`seeds.ts` 是纯逻辑，可以直接测。
 *
 * ## 两个「必须」
 *
 * 1. **可读性**。极亮主色配暗色模式、极暗主色配亮色模式，如果不做钳制
 *    会出现「暗底上的暗 accent」这种根本看不见的配色。
 * 2. **每套主题 × 两种模式**。主题只提供品牌色，明暗由用户偏好决定，
 *    所以 11 套主题在 light / dark 下各派生一遍，**22 组都必须通过**。
 *    只测主题自带的那个模式会漏掉一半组合 —— 这正是「Tabs 选中态白底白字」
 *    能溜过去的原因。
 */

import {
  CONTRAST_AA,
  bestTextOn,
  contrastRatio,
  ensureContrast,
  luminance,
  mix,
  parseColor,
  relativeLuminance,
  toHex,
  withAlpha,
} from "@/theme/color";
import { DEFAULT_BACKGROUND_OPACITY } from "@/theme/background";
import { MODES, OVERRIDABLE_TOKENS, THEME_SEEDS, deriveTokens } from "@/theme/seeds";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failed += 1;
    console.log(
      `  \u2717 ${name}\n      ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** 所有 (主题 × 模式) 组合，供各断言遍历 */
const CASES = THEME_SEEDS.flatMap((seed) =>
  MODES.map((mode) => ({ seed, mode, label: `${seed.id}/${mode}` }))
);

/* ---- 1. 颜色工具 ---- */
console.log("\n1. 颜色工具");

check("parseColor 支持 3 位 / 6 位 / rgb()", () => {
  assert(toHex(parseColor("#abc")) === "#aabbcc", "3 位 hex");
  assert(toHex(parseColor("#aabbcc")) === "#aabbcc", "6 位 hex");
  assert(toHex(parseColor("rgb(10, 20, 30)")) === "#0a141e", "rgb()");
});

check("parseColor 遇到垃圾输入不崩（返回中性灰）", () => {
  assert(toHex(parseColor("not-a-color")) === "#808080", "垃圾输入");
  assert(toHex(parseColor("oklch(0.5 0 0)")) === "#808080", "oklch 不被误当 hex");
});

check("mix 是线性插值", () => {
  assert(toHex(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 0.5)) === "#323232", "中点");
});

check("luminance 黑白两端正确", () => {
  assert(luminance({ r: 0, g: 0, b: 0 }) === 0, "黑应为 0");
  assert(Math.abs(luminance({ r: 255, g: 255, b: 255 }) - 1) < 1e-9, "白应为 1");
});

check("bestTextOn 按亮度选黑白（浅底配黑、深底配白）", () => {
  assert(toHex(bestTextOn({ r: 250, g: 250, b: 250 })) === "#000000", "浅底应配黑字");
  assert(toHex(bestTextOn({ r: 10, g: 10, b: 10 })) === "#ffffff", "深底应配白字");
});

check("8 位 hex（带 alpha）忽略 alpha 分量", () => {
  assert(toHex(parseColor("#32506480")) === "#325064", "应取前 6 位");
});

check("withAlpha 输出合法 8 位 hex（无双井号）", () => {
  // 回归防线：withAlpha 曾经返回 `##f5f6f7d9`（toHex 已带 # 又拼了一个）。
  // RN 解析非法色值会静默回退成黑色，表现为「半透明面板莫名变黑块」。
  assert(withAlpha("#f5f6f7", 0.85) === "#f5f6f7d9", `输出非法: ${withAlpha("#f5f6f7", 0.85)}`);
  // 也要丢弃输入自带的 alpha，否则会拼成 10 位
  assert(
    withAlpha("#f5f6f780", 0.85) === "#f5f6f7d9",
    `未丢弃输入 alpha: ${withAlpha("#f5f6f780", 0.85)}`
  );
});

/* ---- 2. 对比度反解工具 ---- */
console.log("\n2. 对比度反解工具（可读性钳制的基础）");

check("ensureContrast 对已达标颜色不做修改", () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  assert(toHex(ensureContrast(black, white, CONTRAST_AA, true)) === "#000000", "不该动");
});

check("ensureContrast 能把不达标的颜色推到达标", () => {
  const white = { r: 255, g: 255, b: 255 };
  // 一个在白底上几乎看不见的浅色
  const pale = { r: 240, g: 240, b: 240 };
  assert(contrastRatio(pale, white) < CONTRAST_AA, "前提：起点确实不达标");
  const fixed = ensureContrast(pale, white, CONTRAST_AA, true);
  assert(
    contrastRatio(fixed, white) >= CONTRAST_AA,
    `反解后仍不达标: ${contrastRatio(fixed, white).toFixed(2)}`
  );
});

check("ensureContrast 取「刚好达标」而不是一路推到底", () => {
  const white = { r: 255, g: 255, b: 255 };
  const fixed = ensureContrast({ r: 240, g: 240, b: 240 }, white, CONTRAST_AA, true);
  // 不能直接把颜色推成纯黑，那样会丢失品牌色彩
  assert(toHex(fixed) !== "#000000", "过度推到底，丢失了色彩");
  assert(relativeLuminance(fixed) > relativeLuminance({ r: 0, g: 0, b: 0 }), "不该是纯黑");
});

check("bestTextOn 在黑白里挑对比更高的", () => {
  assert(toHex(bestTextOn({ r: 250, g: 250, b: 250 })) === "#000000", "浅底配黑");
  assert(toHex(bestTextOn({ r: 10, g: 10, b: 10 })) === "#ffffff", "深底配白");
});

check("contrastRatio 自反且对称", () => {
  const a = { r: 0, g: 0, b: 0 };
  const b = { r: 255, g: 255, b: 255 };
  assert(Math.abs(contrastRatio(a, a) - 1) < 1e-9, "同色应为 1");
  assert(Math.abs(contrastRatio(a, b) - contrastRatio(b, a)) < 1e-9, "应对称");
  assert(contrastRatio(a, b) > 20, "黑白应约 21:1");
});

/* ---- 3. 11 套主题 × 2 种模式全量派生 ---- */
console.log(
  `\n3. ${THEME_SEEDS.length} 套主题 × ${MODES.length} 种模式 = ${CASES.length} 组全量派生`
);

check("主题数量为 11", () => {
  assert(THEME_SEEDS.length === 11, `应为 11，实际 ${THEME_SEEDS.length}`);
});

check("主题 id 唯一", () => {
  const ids = THEME_SEEDS.map((s) => s.id);
  assert(new Set(ids).size === ids.length, `有重复 id: ${ids.join(", ")}`);
});

check("每组都覆盖全部 token，且不多不少", () => {
  for (const { seed, mode, label } of CASES) {
    const tokens = deriveTokens(seed.primary, seed.secondary, mode);
    const missing = OVERRIDABLE_TOKENS.filter((name) => !(name in tokens));
    assert(missing.length === 0, `${label} 缺少: ${missing.join(", ")}`);
    const extra = Object.keys(tokens).filter(
      (k) => !(OVERRIDABLE_TOKENS as readonly string[]).includes(k)
    );
    assert(extra.length === 0, `${label} 有多余 token: ${extra.join(", ")}`);
  }
});

check("所有 token 值都是合法 hex，且不带 --color- 前缀", () => {
  for (const { seed, mode, label } of CASES) {
    for (const [name, value] of Object.entries(deriveTokens(seed.primary, seed.secondary, mode))) {
      assert(/^#[0-9a-f]{6}$/i.test(value), `${label} 的 ${name} = "${value}" 不是合法 hex`);
      assert(
        !name.startsWith("--color-"),
        `${label} 的 ${name} 带了 --color- 前缀；` +
          "必须覆盖原始变量，@theme inline 会把 --color-* 内联掉"
      );
    }
  }
});

check("暗色模式背景确实暗、亮色模式背景确实亮", () => {
  for (const { seed, mode, label } of CASES) {
    const tokens = deriveTokens(seed.primary, seed.secondary, mode);
    const bgL = luminance(parseColor(tokens["--background"]!));
    if (mode === "dark") {
      assert(bgL < 0.3, `${label} 标为暗色但背景亮度 ${bgL.toFixed(2)} 偏高`);
    } else {
      assert(bgL > 0.7, `${label} 标为亮色但背景亮度 ${bgL.toFixed(2)} 偏低`);
    }
  }
});

/* ---- 3.5 全量 token 配对对比度 ---- */
console.log("\n3.5 全量 token 配对对比度");

/**
 * 「前景 token 必须能在背景 token 上看清」的完整配对表。
 *
 * 这张表是踩坑换来的：之前只测了 `--background`/`--foreground` 与 `--accent`，
 * 结果 **`--segment` / `--segment-foreground` 出问题**（HeroUI 的 Tabs 选中态
 * 正好用这对）漏了过去 —— 选中项几乎看不见。
 *
 * 阈值：正文类 4.5（WCAG AA），次要文字 3.0（AA 对大字号/次要信息放宽）。
 */
const TEXT_PAIRS: readonly { fg: string; bg: string; min: number; note: string }[] = [
  { fg: "--foreground", bg: "--background", min: 4.5, note: "正文 / 页面底" },
  { fg: "--surface-foreground", bg: "--surface", min: 4.5, note: "卡片" },
  { fg: "--surface-secondary-foreground", bg: "--surface-secondary", min: 4.5, note: "次级卡片" },
  { fg: "--surface-tertiary-foreground", bg: "--surface-tertiary", min: 4.5, note: "三级卡片" },
  { fg: "--overlay-foreground", bg: "--overlay", min: 4.5, note: "浮层" },
  { fg: "--default-foreground", bg: "--default", min: 4.5, note: "默认按钮 / 分段控件底" },
  { fg: "--accent-foreground", bg: "--accent", min: 4.5, note: "强调色" },
  // ★ Tabs / 分段控件的选中态就是这一对
  { fg: "--segment-foreground", bg: "--segment", min: 4.5, note: "选中项（Tabs）" },
  // Tabs 列表底色是 --default，选中文字也会落在上面
  { fg: "--segment-foreground", bg: "--default", min: 4.5, note: "选中文字 / Tabs 列表底" },
  { fg: "--field-foreground", bg: "--field-background", min: 4.5, note: "输入框" },
  { fg: "--field-placeholder", bg: "--field-background", min: 3, note: "占位符" },
  { fg: "--muted", bg: "--background", min: 3, note: "次要文字 / 页面底" },
];

check("每组都满足 token 配对对比度", () => {
  const failures: string[] = [];
  for (const { seed, mode, label } of CASES) {
    const tokens = deriveTokens(seed.primary, seed.secondary, mode);
    for (const { fg, bg, min, note } of TEXT_PAIRS) {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      assert(fgValue && bgValue, `${label} 缺少 ${fg} 或 ${bg}`);
      const ratio = contrastRatio(parseColor(fgValue), parseColor(bgValue));
      if (ratio < min) {
        failures.push(
          `${label} ${note}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 < ${min}  [${fgValue} / ${bgValue}]`
        );
      }
    }
  }
  assert(failures.length === 0, `\n      ${failures.join("\n      ")}`);
});

check("选中态与未选中态的文字不能撞色", () => {
  /*
   * Tabs 的选中标签用 `--segment-foreground`，未选中的用 `--muted`。
   * 只要这两者「看着一样」，用户就只能靠底块的色差判断选中项 ——
   * Gekkou No Carnevale 暗色下它们曾经都是 #848484（一模一样）。
   *
   * ⚠️ 这里量的是**区分度**（≥1.5:1），不是可读性：两者各自在自己的底上
   * 都要满足 AA，那是由上面那张 TEXT_PAIRS 保证的。
   */
  const MIN_DISTINCT = 1.5;
  const failures: string[] = [];
  for (const { seed, mode, label } of CASES) {
    const tokens = deriveTokens(seed.primary, seed.secondary, mode);
    const ratio = contrastRatio(
      parseColor(tokens["--segment-foreground"]!),
      parseColor(tokens["--muted"]!)
    );
    if (ratio < MIN_DISTINCT) {
      failures.push(
        `${label} 选中文字 ${tokens["--segment-foreground"]} 与未选中文字 ${tokens["--muted"]} 只差 ${ratio.toFixed(2)}:1`
      );
    }
  }
  assert(failures.length === 0, `共 ${failures.length} 组不达标 >> ${failures.join(" | ")}`);
});

check("选中态指示块与列表底有明显色差", () => {
  /*
   * 「选中块看起来没有背景」正是攻防过的点：亮色模式下曾把 segment
   * 取成 #f2f2f2，和白底几乎一样。
   *
   * ⚠️ 这里量的是**色差**而不是亮度差。因为中间亮度的底（相对亮度 ~0.2）
   * 无论配黑字还是白字都到不了 4.5:1（数学上做不到），所以选中块必须留在
   * 「偏暗配亮字」或「偏亮配暗字」的安全区里 —— 色差只能靠色相/饱和度给。
   * 用亮度差来卡会逼着实现去调亮度，反而把对比度搞坏。
   *
   * 25 这个阈值是「比混色比例 20% 时的最差值（22）高一点」定的：
   * 当时暗色主题下几乎看不出选中块，提到 30% 后最小值是 33。
   */
  const MIN_CHANNEL_DELTA = 25;
  const failures: string[] = [];
  for (const { seed, mode, label } of CASES) {
    const tokens = deriveTokens(seed.primary, seed.secondary, mode);
    const seg = parseColor(tokens["--segment"]!);
    const def = parseColor(tokens["--default"]!);
    const delta = Math.max(
      Math.abs(seg.r - def.r),
      Math.abs(seg.g - def.g),
      Math.abs(seg.b - def.b)
    );
    if (delta < MIN_CHANNEL_DELTA) {
      failures.push(
        `${label} segment ${tokens["--segment"]} 与 default ${tokens["--default"]} 最大通道差仅 ${delta}`
      );
    }
  }
  assert(failures.length === 0, `共 ${failures.length} 组不达标 >> ${failures.join(" | ")}`);
});

check("遮罩默认值落在合法区间", () => {
  assert(
    DEFAULT_BACKGROUND_OPACITY >= 0 && DEFAULT_BACKGROUND_OPACITY <= 1,
    `默认遮罩 ${DEFAULT_BACKGROUND_OPACITY} 越界`
  );
});

/* ---- 4. 抽样输出 ---- */
console.log("\n4. 派生结果抽样（背景 / 前景 / 选中态）");
console.log(
  "  主题".padEnd(26) +
    "模式  " +
    "背景".padEnd(10) +
    "前景".padEnd(10) +
    "segment".padEnd(10) +
    "seg-fg".padEnd(10) +
    "对比"
);
for (const { seed, mode } of CASES) {
  const t = deriveTokens(seed.primary, seed.secondary, mode);
  console.log(
    `  ${seed.name}`.padEnd(26) +
      (mode === "dark" ? "暗    " : "亮    ") +
      t["--background"]!.padEnd(10) +
      t["--foreground"]!.padEnd(10) +
      t["--segment"]!.padEnd(10) +
      t["--segment-foreground"]!.padEnd(10) +
      // contrastRatio 吃 Rgb，这里要先 parse（传 hex 字符串会得到 NaN）
      contrastRatio(parseColor(t["--segment"]!), parseColor(t["--segment-foreground"]!)).toFixed(2)
  );
}

/* ---- 汇总 ---- */
console.log(`\n${"=".repeat(60)}`);
console.log(`通过 ${passed} / 失败 ${failed}`);
console.log("=".repeat(60));

if (failed > 0) process.exit(1);
