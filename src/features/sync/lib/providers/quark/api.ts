import { t } from "@/lib/i18n/translate";
import type { ProviderContext } from "../types";
import { authenticated, jsonResponse } from "./network";

export async function api<T>(
  ctx: ProviderContext,
  path: string,
  body?: unknown,
  query: Record<string, string> = {}
): Promise<{ data: T; metadata?: { part_size?: number } }> {
  const url =
    "https://drive-pc.quark.cn/1/clouddrive" +
    path +
    "?" +
    new URLSearchParams({ pr: "ucpro", fr: "pc", ...query });
  const response = await authenticated(
    ctx,
    url,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
  );
  const result = await jsonResponse(response);
  if (result.code === 31001 || result.status === 401) throw new Error(t("sync.quark.notConnected"));
  if (result.status !== 200 || (result.code !== undefined && result.code !== 0))
    throw new Error(t("sync.quark.apiError", { code: String(result.code ?? result.status) }));
  return result;
}
