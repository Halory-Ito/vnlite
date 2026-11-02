import { t } from "@/lib/i18n/translate";
import { TIMEOUT_MS } from "../http";
import type { ProviderContext } from "../types";
import { CookieJar } from "./cookies";

export const REFERER = "https://pan.quark.cn/";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";
export function trustedUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(t("sync.quark.invalidResponse"));
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !/(^|\.)(quark\.cn|quark\.com|aliyuncs\.com|ucweb\.com|uc\.cn)$/.test(url.hostname)
  )
    throw new Error(t("sync.quark.invalidResponse"));
  return url;
}
export type QuarkResponse = Pick<
  Response,
  "status" | "ok" | "headers" | "json" | "text" | "arrayBuffer"
>;
export async function jsonResponse(response: QuarkResponse): Promise<any> {
  try {
    const result = await response.json();
    if (!result || typeof result !== "object") throw Error();
    return result;
  } catch {
    throw new Error(t("sync.quark.invalidResponse"));
  }
}
export async function rawRequest(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<QuarkResponse> {
  trustedUrl(url);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, TIMEOUT_MS);
  try {
    const { fetch } = await import("expo/fetch");
    const response = (await fetch(url, {
      ...init,
      credentials: "omit",
      redirect: "manual",
      signal: controller.signal,
    })) as Response;
    // Keep the abort deadline active until the body is read, including native streams.
    const body = await response.arrayBuffer();
    const text = () => new TextDecoder().decode(body);
    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      arrayBuffer: async () => body,
      text: async () => text(),
      json: async () => JSON.parse(text()),
    };
  } catch {
    if (controller.signal.aborted) throw new Error(t("sync.timeout"));
    // Native errors may contain signed URLs or login tickets.
    throw new Error(t("sync.networkError"));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function sessionRequest(
  jar: CookieJar,
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<QuarkResponse> {
  let target = url;
  for (let hop = 0; hop < 5; hop++) {
    const response = await rawRequest(
      target,
      {
        ...init,
        headers: {
          "User-Agent": USER_AGENT,
          Referer: REFERER,
          Cookie: jar.header(target),
          ...init.headers,
        },
      },
      signal
    );
    jar.absorb(target, response.headers);
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location || (init.method && init.method !== "GET" && init.method !== "HEAD")) break;
    target = trustedUrl(new URL(location, target).toString()).toString();
  }
  throw new Error(t("sync.quark.invalidResponse"));
}

const queues = new Map<string, Promise<unknown>>();
export async function serial<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(action);
  queues.set(key, task);
  try {
    return await task;
  } finally {
    if (queues.get(key) === task) queues.delete(key);
  }
}
export async function authenticated(
  ctx: ProviderContext,
  url: string,
  init: RequestInit = {}
): Promise<QuarkResponse> {
  return serial(`cookie:${ctx.configId}`, async () => {
    const jar = await CookieJar.load(ctx.secrets);
    if (!jar.header("https://drive-pc.quark.cn/")) throw new Error(t("sync.quark.notConnected"));
    const previous = jar.serialize();
    const response = await sessionRequest(jar, url, init);
    if (previous !== jar.serialize()) await jar.save(ctx.secrets);
    if (response.status === 401 || response.status === 403)
      throw new Error(t("sync.quark.notConnected"));
    if (!response.ok) throw new Error(t("sync.requestFailed", { status: String(response.status) }));
    return response;
  });
}
