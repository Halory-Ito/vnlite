/**
 * 翻译目录的纯工具（bun 冒烟直接 import，不碰 i18n-js / 原生模块）。
 */

export type NestedCatalog = { [key: string]: string | NestedCatalog };

/** 把嵌套目录拍平成 `a.b.c` 的键数组 */
export function flattenCatalog(catalog: NestedCatalog, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") keys.push(full);
    else keys.push(...flattenCatalog(value, full));
  }
  return keys;
}

/**
 * 两份目录的键集合差异。
 * `missing` = b 缺的键（漏翻译）；`extra` = b 多出的键（目录漂移）。
 */
export function diffCatalogKeys(
  a: NestedCatalog,
  b: NestedCatalog
): { missing: string[]; extra: string[] } {
  const aKeys = new Set(flattenCatalog(a));
  const bKeys = new Set(flattenCatalog(b));
  return {
    missing: [...aKeys].filter((key) => !bKeys.has(key)).sort(),
    extra: [...bKeys].filter((key) => !aKeys.has(key)).sort(),
  };
}
