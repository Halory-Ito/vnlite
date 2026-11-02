import { t } from "@/lib/i18n/translate";
import { request } from "../http";
import type { ProviderContext } from "../types";
import { accessToken } from "./oauth";

export interface BaiduResult {
  errno?: number;
  error_code?: number;
}
export class BaiduApiError extends Error {
  constructor(public code: number) {
    super(t("sync.baidu.apiError", { code: String(code) }));
  }
}
export function checkResult(data: BaiduResult): void {
  const code = data.errno ?? data.error_code ?? 0;
  if (code !== 0) throw new BaiduApiError(code);
}
export async function api<T extends BaiduResult>(
  ctx: ProviderContext,
  route: string,
  query: Record<string, string>,
  fields?: Record<string, string>
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(ctx, attempt > 0);
    const response = await request(
      `https://pan.baidu.com/rest/2.0/xpan/${route}?${new URLSearchParams({ ...query, access_token: token })}`,
      {
        method: fields ? "POST" : "GET",
        ...(fields
          ? {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams(fields).toString(),
            }
          : {}),
      }
    );
    const data = (await response.json()) as T;
    if (attempt === 0 && [110, 111, -6].includes(data.errno ?? data.error_code ?? 0)) continue;
    if (!response.ok) throw new Error(t("sync.requestFailed", { status: String(response.status) }));
    checkResult(data);
    return data;
  }
  throw new Error(t("sync.baidu.notConnected"));
}
export function rootPath(ctx: ProviderContext): string {
  return ctx.options.rootPath || "/apps/vnlite";
}
