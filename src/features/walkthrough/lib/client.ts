/**
 * 攻略的网络层：从 GitHub 仓库取索引 / 单篇攻略的静态 JSON。
 *
 * ⚠️ 走的是**自己的 GitHub 仓库**，不是 Kana API —— Kana 没有任何攻略端点。
 *
 * ## 两个源，逐个降级
 *
 * `constants/config.ts` 的 `WALKTHROUGH_SOURCES` 里排了两个地址（GitHub 原始文件 +
 * jsDelivr 镜像），内容同源。第一个失败（超时 / 4xx / 5xx）就试下一个，全失败才报错。
 *
 * ## 超时为什么自己实现
 *
 * `AbortSignal.timeout` 在 Hermes 上不可用；`ApiError` 又是给 Kana 用的，
 * 这里的错误语义也不同（没有 401 / 429 那套）。所以用 `setTimeout` + 手动
 * `controller.abort()`，并把调用方传来的 `signal` 一并接上（组件卸载 / 切页签要能取消）。
 *
 * 解析单独放在 `parse.ts` —— 这个文件只管「拿到字符串」，脏数据由那边兜。
 */

import { WALKTHROUGH_INDEX_PATH, WALKTHROUGH_SOURCES } from "@/constants/config";
import { ApiError } from "@/lib/api/errors";

import { parseWalkthrough, parseWalkthroughIndex } from "./parse";
import type { Walkthrough, WalkthroughIndex } from "./types";

/**
 * 单源超时。取 6 秒：
 *   - 索引有 ~190KB，国内直连 GitHub 常见十几秒起
 *   - 但用户点开页签愿意等的也就这个量级，再久就该失败让他重试
 */
const TIMEOUT_MS = 6000;

/** 一次请求（已含超时与外部取消） */
async function requestText(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // 调用方的取消要能打断我们的计时器，否则会泄漏
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      // 移动端 fetch 不允许自定义 User-Agent，只声明接受 JSON
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new ApiError(
        response.status === 404 ? "not_found" : "server_error",
        `攻略仓库请求失败（HTTP ${response.status}）`,
        { status: response.status, endpoint: url }
      );
    }
    return await response.text();
  } catch (error) {
    // 外部主动取消原样抛（React Query 用它区分「取消」与「失败」），超时也算取消
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw ApiError.network(new Error(`请求超时（${TIMEOUT_MS / 1000} 秒）`), url);
    }
    throw ApiError.network(error, url);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** 依次尝试各源；全失败抛最后一个错误（多数情况下是最有信息量的那个） */
async function requestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let lastError: unknown;
  for (const base of WALKTHROUGH_SOURCES) {
    try {
      const text = await requestText(`${base}/${path}`, signal);
      return JSON.parse(text) as unknown;
    } catch (error) {
      // 调用方已取消就别再试下一个源了
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError ?? ApiError.network(new Error("没有可用的攻略数据源"), path);
}

/** 全部攻略的索引：vid → 文件路径 + 统计（约 190KB，是「这篇有没有攻略」的唯一依据） */
export async function fetchWalkthroughIndex(signal?: AbortSignal): Promise<WalkthroughIndex> {
  return parseWalkthroughIndex(await requestJson(WALKTHROUGH_INDEX_PATH, signal));
}

/**
 * 单篇攻略。`path` 用索引里给的相对路径（`walkthroughs/…/v4.json`），
 * 不用自己按 vid 拼 —— 目录规则是仓库的事，客户端不该猜。
 */
export async function fetchWalkthrough(
  vid: string,
  path: string,
  signal?: AbortSignal
): Promise<Walkthrough> {
  return parseWalkthrough(await requestJson(path, signal), vid);
}
