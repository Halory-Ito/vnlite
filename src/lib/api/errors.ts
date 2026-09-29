/**
 * 类型化 API 错误。
 *
 * client.ts 把 Kana 的 HTTP 状态码统一映射到这里，UI 层只需 `instanceof`
 * 判断即可决定重试 / 提示 / 跳登录。
 */

export type ApiErrorKind =
  /** 400：请求体或过滤器非法 —— 通常是字段名或过滤器写法错了，重试无用 */
  | "bad_request"
  /** 401：Token 无效或缺失 —— 需要重新登录 */
  | "unauthorized"
  /** 404：端点或方法不存在 —— 多为拼写错误或该端点确实不开放 */
  | "not_found"
  /** 429：被限流 —— 退避后重试 */
  | "rate_limited"
  /** 5xx：服务端错误 —— 退避后重试 */
  | "server_error"
  /** 网络不可达 / DNS / 超时 */
  | "network"
  /** 解析失败 */
  | "parse"
  /** 未知 */
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** 服务端返回的原始错误串，Kana 直接把消息放在 body 里 */
  readonly detail?: string;
  /** 端点路径，便于定位 */
  readonly endpoint?: string;
  override readonly cause?: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; detail?: string; endpoint?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
    this.endpoint = options.endpoint;
    this.cause = options.cause;
  }

  /** 值得重试的错误类型 */
  get isRetryable(): boolean {
    return this.kind === "rate_limited" || this.kind === "server_error" || this.kind === "network";
  }

  /** 是否需要用户重新登录 */
  get needsAuth(): boolean {
    return this.kind === "unauthorized";
  }

  /** 给用户看的简短中文提示 */
  get userMessage(): string {
    switch (this.kind) {
      case "bad_request":
        return "请求被 VNDB 拒绝，多半是筛选条件写错了";
      case "unauthorized":
        return "Token 无效或已失效，请重新登录";
      case "not_found":
        return "接口不存在或条目已删除";
      case "rate_limited":
        return "请求太频繁，已自动排队，请稍候";
      case "server_error":
        return "VNDB 服务器暂时不可用";
      case "network":
        return "网络连接失败，请检查网络";
      case "parse":
        return "响应解析失败";
      default:
        return "出错了";
    }
  }

  static badRequest(detail: string, endpoint?: string): ApiError {
    return new ApiError("bad_request", `VNDB 拒绝了请求：${detail}`, {
      status: 400,
      detail,
      endpoint,
    });
  }

  static unauthorized(detail: string, endpoint?: string): ApiError {
    return new ApiError("unauthorized", "Token 无效或缺失", { status: 401, detail, endpoint });
  }

  static notFound(detail: string, endpoint?: string): ApiError {
    return new ApiError("not_found", "接口或条目不存在", { status: 404, detail, endpoint });
  }

  static rateLimited(retryAfterMs?: number, endpoint?: string): ApiError {
    return new ApiError("rate_limited", "触发 VNDB 速率限制", {
      status: 429,
      endpoint,
      detail: retryAfterMs ? `${retryAfterMs}ms 后可重试` : undefined,
    });
  }

  static server(status: number, detail: string, endpoint?: string): ApiError {
    return new ApiError("server_error", `VNDB 服务端错误（${status}）`, {
      status,
      detail,
      endpoint,
    });
  }

  static network(cause: unknown, endpoint?: string): ApiError {
    return new ApiError("network", "网络请求失败", { endpoint, cause });
  }

  static parse(cause: unknown, endpoint?: string): ApiError {
    return new ApiError("parse", "响应解析失败", { endpoint, cause });
  }
}

/** 把任意 catch 到的东西归一成 ApiError */
export function toApiError(error: unknown, endpoint?: string): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    return new ApiError("network", error.message, { endpoint, cause: error });
  }
  return new ApiError("unknown", String(error), { endpoint, cause: error });
}
