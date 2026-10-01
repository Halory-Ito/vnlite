/**
 * 防抖值。
 *
 * 搜索场景：每敲一个字都打一次接口会白烧 VNDB 的限流配额（令牌桶 200 次 / 5 分钟），
 * 所以输入框的值延迟 `delayMs` 之后才对外可见。组件只订阅防抖后的值，
 * 输入框本身仍然用原值（不然打字会一顿一顿的）。
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
