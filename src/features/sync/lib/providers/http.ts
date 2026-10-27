/**
 * 供应商共用的 HTTP 小工具（纯 fetch，bun 冒烟能跑）。
 *
 * ## 超时自己实现
 *
 * `AbortSignal.timeout` 在 Hermes 上不可用（同 `features/walkthrough/lib/client`），
 * 这里用 `setTimeout` + 手动 `controller.abort()`。
 */

import { t } from "@/lib/i18n/translate";

/** 单次请求超时（备份可能几 MB，慢网络留够时间） */
export const TIMEOUT_MS = 60_000;

/** 发一个带超时的请求 */
export async function request(
  url: string,
  init: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(t("sync.timeout"), { cause: error });
    throw new Error(t("sync.networkError"), { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
