/**
 * 颜色工具：从「品牌色」推导出 HeroUI 需要的一整套 token。
 *
 * 背景：vndb-lite 的每个主题只给 5 个值（seedColor / primary / secondary /
 * tertiary / brightness），Flutter 会自动派生出整套 Material 配色。
 * HeroUI Native 不会 —— 必须把每个 token 显式算出来。
 *
 * 所以这里的做法是：定义「配方」，从 primary/secondary/tertiary 按明暗模式
 * 推导出 ~28 个 token。这样加一个主题只需要填 5 个色值。
 *
 * 全部用 sRGB hex 做混合 —— 不用 oklch，原因：
 *   - 手算 oklch 混合容易出错，不可预测
 *   - 主题色是从 vndb-lite 的 Flutter ARGB 直接搬过来的，hex 更直观
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp = (n: number, min = 0, max = 255): number => Math.min(max, Math.max(min, n));

/**
 * 解析颜色。
 *
 * ⚠️ 必须先验证是不是合法 hex 再取值，不能只看长度：
 * `"rgb(50, 80, 100)"` 长度 15 >= 6，直接走 hex 分支会
 * `parseInt("rg", 16)` → NaN，静默返回垃圾颜色。
 */
export function parseColor(input: string): Rgb {
  const raw = input.trim();
  const hex = raw.replace(/^#/, "");

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    // 带 alpha，忽略 alpha 分量
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgb = raw.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  // 解析不了就用中性灰，至少不崩
  return { r: 128, g: 128, b: 128 };
}

function hexPart(n: number): string {
  return Math.round(clamp(n)).toString(16).padStart(2, "0");
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${hexPart(r)}${hexPart(g)}${hexPart(b)}`;
}

/** 线性插值。t=0 返回 a，t=1 返回 b */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * WCAG AA 正文对比度目标。
 * `deriveTokens` 用它反解颜色，`scripts/smoke-theme.ts` 用同一个常量断言 ——
 * 测与跑共用一处定义，不会出现「测的那份通过、跑的那份不达标」。
 */
export const CONTRAST_AA = 4.5;
/** 次要文字（大字号 / 辅助信息）的目标 */
export const CONTRAST_MUTED = 3;

function srgbChannel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 相对亮度（WCAG 2.x），0–1 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

/**
 * WCAG 对比度，1–21。
 *
 * 放在这里而不是只写在测试脚本里：`deriveTokens` 要靠它**反推**颜色
 * （见 `ensureContrast`）。如果测试和实现各写一份，就可能出现
 * 「测的那份算通过、跑的那份其实不达标」。
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * 把颜色量化成最终会写进 token 的 hex 精度（每通道取整）。
 *
 * ⚠️ `ensureContrast` 必须在**量化之后**判对比度。
 * 否则会算出「4.4999:1 判定达标 → 取整成 hex 后实际 4.49:1」这种
 * 「实现自以为通过、测试却挂掉」的情况 —— 冒烟测试抓到过 4.49:1 < 4.5。
 * 统一走这个函数，比对时的值就是最终上屏的值。
 */
export function quantize(color: Rgb): Rgb {
  return parseColor(toHex(color));
}

/**
 * 把颜色往黑（或白）推，直到与 `against` 的对比度达标。
 *
 * ## 为什么需要它
 *
 * 老实现是「按固定比例混色」猜前景色，比如亮色模式下
 * `mix(primary, BLACK, 0.25)`。固定比例**保证不了对比度**：
 *   - Higurashi 的 primary `#F5B4AF` 压 25% 黑后是 `#b88783`，
 *     在白底上只有 2.99:1 —— 远低于 WCAG AA 的 4.5
 *   - Seinarukana 的 `#7c7575` 是 4.48:1，卡在线上
 *
 * 改成**按目标对比度反解**：先看原色够不够，不够就用二分法找到
 * 「刚好达标」的最小修改量。既保证可读，又不会把颜色推得过头而失去品牌感。
 *
 * @param color 原始颜色
 * @param against 背景色（调用方应传已量化的值）
 * @param target 目标对比度（正文 4.5，次要文字 3）
 * @param darken true = 往黑推（浅底用），false = 往白推（深底用）
 */
export function ensureContrast(color: Rgb, against: Rgb, target: number, darken: boolean): Rgb {
  const start = quantize(color);
  if (contrastRatio(start, against) >= target) return start;

  const extreme = darken ? BLACK : WHITE;
  let low = 0;
  let high = 1;
  // 12 次二分后精度约 1/4096，肉眼与 hex 量化都看不出差别
  for (let i = 0; i < 12; i += 1) {
    const mid = (low + high) / 2;
    // 量化后再判：保证「搜索时通过的」就是「最终写进 token 的」
    if (contrastRatio(quantize(mix(start, extreme, mid)), against) >= target) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return quantize(mix(start, extreme, high));
}

/**
 * 在黑白之间挑一个与 `background` 对比更高的。
 * 用于「实心块上的文字」（accent / success 这类填充色上的标签）。
 */
export function bestTextOn(background: Rgb): Rgb {
  return contrastRatio(BLACK, background) >= contrastRatio(WHITE, background) ? BLACK : WHITE;
}

/** 感知亮度（ITU-R BT.601），0–1 */
export function luminance({ r, g, b }: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** 往白/黑方向拉。amount>0 变亮，<0 变暗 */
export function shade(color: Rgb, amount: number): Rgb {
  return amount >= 0 ? mix(color, WHITE, amount) : mix(color, BLACK, -amount);
}

/**
 * 给颜色加透明度，输出 8 位 hex（`#rrggbbaa`），React Native 原生支持。
 *
 * 用途：Tab 栏 / 吸顶条这类「悬浮面板」需要半透明才能透出底下的背景图，
 * 又不能像 `opacity` 那样把里面的文字一起变淡 —— 所以只改底色、不改内容。
 *
 * ⚠️ 会**丢弃**输入自带的 alpha 再重新计算，避免出现 `#rrggbbaa` + alpha
 * 拼成 10 位 hex 这种非法色值。
 *
 * ⚠️ `toHex()` 自带 `#` 前缀，这里**不能**再拼一个 ——
 * 否则会得到 `##f5f6f7d9` 这种双井号色值。RN 解析失败会静默回退成黑色，
 * 表现是「半透明面板莫名其妙变成黑块」。`scripts/smoke-theme.ts` 有断言卡这个。
 */
export function withAlpha(color: string, alpha: number): string {
  const { r, g, b } = parseColor(color);
  const a = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${toHex({ r, g, b })}${a}`;
}

/**
 * 在深色底上用的「亮品牌色」—— 保证不会暗到看不见。
 * 阈值 0.35：低于此亮度混 45% 白。
 */
export function readableOnDark(color: Rgb): Rgb {
  return luminance(color) < 0.35 ? mix(color, WHITE, 0.45) : color;
}

/**
 * 在浅色底上用的「暗品牌色」。
 * 阈值 0.6：高于此亮度混 35% 黑。
 */
export function readableOnLight(color: Rgb): Rgb {
  return luminance(color) > 0.6 ? mix(color, BLACK, 0.35) : color;
}

/**
 * 文字色：在给定底色上选黑或白。
 * @param threshold 低于该亮度用黑字，高于用白字
 */
export function contrastText(bg: Rgb, threshold = 0.55): Rgb {
  return luminance(bg) > threshold ? BLACK : WHITE;
}
