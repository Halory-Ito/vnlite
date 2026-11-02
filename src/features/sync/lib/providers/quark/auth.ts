import { t } from "@/lib/i18n/translate";
import type { ProviderContext } from "../types";
import { CookieJar } from "./cookies";
import { serial, sessionRequest, jsonResponse } from "./network";

const CAS = "https://uop.quark.cn/cas/ajax/";
export interface QuarkLogin {
  url: string;
  expiresAt: number;
  token: string;
  requestId: string;
  jar: CookieJar;
}
async function cas(
  jar: CookieJar,
  path: string,
  params: Record<string, string>,
  signal: AbortSignal
) {
  const url = CAS + path + "?" + new URLSearchParams({ client_id: "532", v: "1.2", ...params });
  const response = await sessionRequest(jar, url, {}, signal);
  if (!response.ok) throw new Error(t("sync.quark.authFailed"));
  return jsonResponse(response);
}
export async function startLogin(signal: AbortSignal): Promise<QuarkLogin> {
  const jar = new CookieJar();
  const requestId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
  const data = await cas(jar, "getTokenForQrcodeLogin", { request_id: requestId }, signal);
  const token = data.data?.members?.token;
  if (data.status !== 2000000 || typeof token !== "string" || !token)
    throw new Error(t("sync.quark.authFailed"));
  return {
    jar,
    requestId,
    token,
    expiresAt: Date.now() + 180000,
    url:
      "https://su.quark.cn/4_eMHBJ?" +
      new URLSearchParams({
        token,
        client_id: "532",
        ssb: "weblogin",
        uc_param_str: "",
        uc_biz_str: "S:custom|OPT:SAREA@0|OPT:IMMERSIVE@1|OPT:BACK_BTN_STYLE@0",
      }),
  };
}
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new Error(t("sync.quark.cancelled")));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort);
    if (signal?.aborted) abort();
  });
}
export async function finishLogin(
  ctx: ProviderContext,
  login: QuarkLogin,
  signal: AbortSignal
): Promise<void> {
  while (Date.now() < login.expiresAt) {
    if (signal.aborted) throw new Error(t("sync.quark.cancelled"));
    const result = await cas(
      login.jar,
      "getServiceTicketByQrcodeToken",
      { request_id: login.requestId, token: login.token },
      signal
    );
    const ticket = result.data?.members?.service_ticket;
    if (result.status === 50004002) throw new Error(t("sync.quark.expired"));
    if (result.status === 2000000 && typeof ticket === "string" && ticket) {
      const url =
        "https://pan.quark.cn/account/info?" + new URLSearchParams({ st: ticket, lw: "scan" });
      const response = await sessionRequest(login.jar, url, {}, signal);
      const data = await jsonResponse(response);
      if (!response.ok || !data.success || !login.jar.header("https://drive-pc.quark.cn/"))
        throw new Error(t("sync.quark.authFailed"));
      if (signal.aborted) throw new Error(t("sync.quark.cancelled"));
      await serial(`files:${ctx.configId}`, () =>
        serial(`cookie:${ctx.configId}`, async () => {
          if (signal.aborted) throw new Error(t("sync.quark.cancelled"));
          await login.jar.save(ctx.secrets);
        })
      );
      return;
    }
    if (result.status !== 50004001 && result.status !== 2000000)
      throw new Error(t("sync.quark.authFailed"));
    await delay(2500, signal);
  }
  throw new Error(t("sync.quark.expired"));
}
