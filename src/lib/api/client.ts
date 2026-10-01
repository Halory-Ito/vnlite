/**
 * Kana API HTTP 客户端。
 *
 * 职责：
 *   1. 注入 Token（`Authorization: Token xxx`）
 *   2. 过限流器，再真正发请求
 *   3. 把 400/401/404/429/5xx 映射成 `ApiError`
 *   4. 429 与网络抖动自动指数退避重试
 *   5. 单请求 3s 超时（服务端超 3s 也会中止，客户端需更早放弃）
 */

import { API_BASE_URL, RATE_LIMIT } from "@/constants/config";

import { ApiError, toApiError } from "./errors";
import { rateLimiter, type RateLimiter } from "./rate-limiter";
import type { QueryBody, QueryResponse } from "./types";

/** Token 提供器。返回 null 表示未登录 */
export type TokenProvider = () => string | null | Promise<string | null>;

export interface ClientOptions {
  baseUrl?: string;
  getToken?: TokenProvider;
  limiter?: RateLimiter;
  /** 最大重试次数（仅对可重试错误生效） */
  maxRetries?: number;
}

export interface RequestOptions {
  /** 覆盖默认的 Authorization 头（用于 Token 本身这种不带鉴权的请求） */
  auth?: boolean;
  /** 覆盖单请求超时 */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 关闭重试，用于写操作（避免重复 PATCH） */
  retry?: boolean;
}

/** 指数退避 + 抖动，避免整队请求同时重试再撞 429 */
function backoffDelay(attempt: number): number {
  const base = Math.min(RATE_LIMIT.retryBaseDelayMs * 2 ** attempt, RATE_LIMIT.retryMaxDelayMs);
  return base + Math.floor(Math.random() * 500);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class VndbClient {
  private readonly baseUrl: string;
  private readonly getToken: TokenProvider;
  private readonly limiter: RateLimiter;
  private readonly maxRetries: number;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? API_BASE_URL;
    this.getToken = options.getToken ?? (() => null);
    this.limiter = options.limiter ?? rateLimiter;
    this.maxRetries = options.maxRetries ?? RATE_LIMIT.maxRetries;
  }

  /** POST 查询端点：`/vn` `/release` `/character` … */
  async query<T>(
    endpoint: string,
    body: QueryBody,
    options: RequestOptions = {}
  ): Promise<QueryResponse<T>> {
    return this.request<QueryResponse<T>>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    });
  }

  /** GET 端点：`/user` `/stats` `/schema` `/authinfo` `/ulist_labels` */
  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", ...options });
  }

  /** PATCH 写端点：`/ulist/{id}` `/rlist/{id}` */
  async patch<T>(endpoint: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { method: "PATCH", body: JSON.stringify(body), ...options });
  }

  /** DELETE 写端点：`/ulist/{id}` `/rlist/{id}` —— 成功返回 204 空体 */
  async delete(endpoint: string, options: RequestOptions = {}): Promise<void> {
    await this.request<null>(endpoint, { method: "DELETE", ...options });
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit & RequestOptions,
    attempt = 0
  ): Promise<T> {
    const { auth = true, timeoutMs = RATE_LIMIT.requestTimeoutMs, signal, retry, ...rest } = init;
    const allowRetry = retry ?? true;
    const maxAttempts = allowRetry ? this.maxRetries + 1 : 1;

    // 先过限流器，拿到「真正发完请求后要回调」的 commit 函数
    const commit = await this.limiter.acquire();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (rest.body) headers["Content-Type"] = "application/json";
      if (auth) {
        const token = await this.getToken();
        if (token) headers.Authorization = `Token ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...rest,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await this.readErrorDetail(response);
        throw this.mapHttpError(response, detail, endpoint);
      }

      // 204 / 空体
      if (response.status === 204) return null as T;
      const text = await response.text();
      if (!text) return null as T;

      try {
        return JSON.parse(text) as T;
      } catch (cause) {
        throw ApiError.parse(cause, endpoint);
      }
    } catch (error) {
      const apiError = toApiError(error, endpoint);

      // 外部主动取消（组件卸载等）不重试
      if (signal?.aborted) throw apiError;

      if (apiError.kind === "network" && controller.signal.aborted) {
        // 自己的超时计时器触发的
        const timeoutError = new ApiError("network", `请求超时（>${timeoutMs}ms）`, {
          endpoint,
          cause: apiError,
        });
        if (attempt + 1 < maxAttempts) {
          commit();
          await sleep(backoffDelay(attempt));
          return this.request<T>(endpoint, init, attempt + 1);
        }
        throw timeoutError;
      }

      if (apiError.isRetryable && attempt + 1 < maxAttempts) {
        commit();
        await sleep(backoffDelay(attempt));
        return this.request<T>(endpoint, init, attempt + 1);
      }
      throw apiError;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
      // 记账：本次尝试都算占了一次配额（成功或最终失败）
      commit();
    }
  }

  /** Kana 直接把错误消息放在 body 里，不包在 `{error: ...}` 中 */
  private async readErrorDetail(response: Response): Promise<string> {
    try {
      const text = await response.text();
      if (!text) return response.statusText;
      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === "string") return parsed;
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          return String((parsed as { error: unknown }).error);
        }
        return text.slice(0, 300);
      } catch {
        return text.slice(0, 300);
      }
    } catch {
      return response.statusText;
    }
  }

  private mapHttpError(response: Response, detail: string, endpoint: string): ApiError {
    switch (response.status) {
      case 400:
        return ApiError.badRequest(detail, endpoint);
      case 401:
        return ApiError.unauthorized(detail, endpoint);
      case 404:
        return ApiError.notFound(detail, endpoint);
      case 429: {
        const retryAfter = Number(response.headers.get("Retry-After"));
        return ApiError.rateLimited(
          Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
          endpoint
        );
      }
      default:
        return response.status >= 500
          ? ApiError.server(response.status, detail, endpoint)
          : new ApiError("unknown", `HTTP ${response.status}`, {
              status: response.status,
              detail,
              endpoint,
            });
    }
  }

  /** 当前限流用量，设置页展示用 */
  usage() {
    return this.limiter.usage();
  }
}

/** 全局单例。Token 由 `lib/storage/secure.ts` 在运行时注入，避免循环依赖 */
export const api = new VndbClient({
  getToken: () => tokenProviderRef.current?.() ?? null,
});

/**
 * 延迟绑定的 Token 来源。
 * 之所以用 ref 而不是直接 import：secure.ts 依赖本 client 做 authinfo 校验，
 * 直接 import 会形成循环依赖。
 */
export const tokenProviderRef: { current: TokenProvider | null } = { current: null };

/** 供应用启动时注册：`(await getToken()) => string | null` */
export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProviderRef.current = provider;
}
