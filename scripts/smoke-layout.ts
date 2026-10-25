/**
 * 冒烟测试：作品封面网格的列数分档（`utils/grid`，纯逻辑）。
 *
 *   bun run scripts/smoke-layout.ts
 *
 * 为什么要测：列数靠**窗口短边**分档，平板的 6 / 8 列只差 56dp
 * （iPad mini 744 vs iPad 10.9 820），阈值写歪了只有真机才看得出来。
 * 另外手机横屏（844dp 宽）是最容易被「按宽度分档」误判成平板的场景。
 */

import {
  COVER_GRID_COLUMNS_COMPACT_TABLET,
  COVER_GRID_COLUMNS_PHONE,
  COVER_GRID_COLUMNS_TABLET,
  coverGridColumns,
} from "@/utils/grid";

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

console.log("\n1. 手机（短边 < 600dp）");
check("iPhone 15 竖屏 393×852", () => {
  assert(coverGridColumns(393, 852) === COVER_GRID_COLUMNS_PHONE, "应 3 列");
});
check("iPhone 15 横屏 852×393 仍是 3 列", () => {
  assert(coverGridColumns(852, 393) === COVER_GRID_COLUMNS_PHONE, "横屏不能被判成平板");
});
check("大屏手机 480×1040", () => {
  assert(coverGridColumns(480, 1040) === COVER_GRID_COLUMNS_PHONE, "应 3 列");
});

console.log("\n2. 小平板（短边 600–799dp）");
check("iPad mini 6 竖屏 744×1133", () => {
  assert(coverGridColumns(744, 1133) === COVER_GRID_COLUMNS_COMPACT_TABLET, "应 6 列");
});
check("iPad mini 6 横屏 1133×744", () => {
  assert(coverGridColumns(1133, 744) === COVER_GRID_COLUMNS_COMPACT_TABLET, "转屏列数不变");
});
check("Android 平板 600×960", () => {
  assert(coverGridColumns(600, 960) === COVER_GRID_COLUMNS_COMPACT_TABLET, "刚好 600 应 6 列");
});

console.log("\n3. 大平板（短边 ≥ 800dp）");
check("iPad 10.9 竖屏 820×1180", () => {
  assert(coverGridColumns(820, 1180) === COVER_GRID_COLUMNS_TABLET, "应 8 列");
});
check("iPad 10.9 横屏 1180×820", () => {
  assert(coverGridColumns(1180, 820) === COVER_GRID_COLUMNS_TABLET, "转屏列数不变");
});
check("iPad Pro 12.9 1024×1366", () => {
  assert(coverGridColumns(1024, 1366) === COVER_GRID_COLUMNS_TABLET, "应 8 列");
});

console.log("\n4. 阈值边界");
check("599 → 3 列", () => {
  assert(coverGridColumns(599, 900) === 3, "599 属于手机");
});
check("800 → 8 列", () => {
  assert(coverGridColumns(800, 900) === 8, "800 已是大平板");
});
check("799 → 6 列", () => {
  assert(coverGridColumns(799, 900) === 6, "799 属于小平板");
});
check("极端窄屏 320 → 3 列", () => {
  assert(coverGridColumns(320, 480) === 3, "不应崩成负数或 0 列");
});

console.log(`\n${"=".repeat(60)}`);
console.log(`通过 ${passed} / 失败 ${failed}`);
console.log(`${"=".repeat(60)}\n`);
process.exit(failed === 0 ? 0 : 1);
