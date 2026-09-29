/**
 * 登录态管理。
 *
 * 流程（Q1 = A：粘贴 Token）：
 *   1. 用户在设置页粘贴 token
 *   2. 调 `GET /authinfo` 验证，同时拿到 id / username / permissions
 *   3. 验证通过才落 SecureStore，并写入本地 `account` 表
 *
 * 权限判断：读私有清单需要 `listread`，写清单需要 `listwrite`。
 * 两者都没有就只能当游客浏览。
 */

import { setTokenProvider, type TokenProvider } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { authInfo } from "@/lib/api/endpoints/ulist";
import { upsertAccount } from "@/lib/db/dao/account";

import { clearToken, getToken, peekToken, setToken } from "./secure";

// 把 Token 来源注册给 API client。
// 放在这里而不是 secure.ts，是为了避免 secure ↔ session 的循环依赖。
registerTokenGetter(peekToken);

export interface Account {
  userId: string;
  username: string;
  permissions: string[];
  /** token 存入本地的时间 */
  loggedInAt: number;
}

export type SessionState =
  { status: "loading" } | { status: "guest" } | { status: "authenticated"; account: Account };

let current: SessionState = { status: "loading" };
const listeners = new Set<(state: SessionState) => void>();

/** 注册给 API client 的同步 Token 来源 */
function registerTokenGetter(getter: TokenProvider): void {
  setTokenProvider(getter);
}

function emit(state: SessionState): void {
  current = state;
  for (const listener of listeners) listener(state);
}

export function getSession(): SessionState {
  return current;
}

export function subscribeSession(listener: (state: SessionState) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function hasPermission(permission: "listread" | "listwrite"): boolean {
  return current.status === "authenticated" && current.account.permissions.includes(permission);
}

/** 应用启动时调用：读本地 token 并验证有效性 */
export async function restoreSession(): Promise<SessionState> {
  const token = await getToken();
  if (!token) {
    emit({ status: "guest" });
    return current;
  }
  try {
    const info = await authInfo();
    const account: Account = {
      userId: info.id,
      username: info.username,
      permissions: info.permissions ?? [],
      loggedInAt: Date.now(),
    };
    await upsertAccount(account);
    emit({ status: "authenticated", account });
  } catch (error) {
    // token 失效：清掉，重回游客态。不要在这里弹错误，静默降级即可
    if (error instanceof ApiError && error.needsAuth) await clearToken();
    emit({ status: "guest" });
  }
  return current;
}

/**
 * 校验并登录。
 * 校验失败抛 `ApiError`（401），由 UI 展示，不会污染本地存储。
 */
export async function loginWithToken(rawToken: string): Promise<Account> {
  const token = normalizeToken(rawToken);
  if (!token) throw new Error("Token 不能为空");

  // 先临时用这个 token 验一次
  const previous = peekToken();
  await setToken(token);
  try {
    const info = await authInfo();
    const account: Account = {
      userId: info.id,
      username: info.username,
      permissions: info.permissions ?? [],
      loggedInAt: Date.now(),
    };
    await upsertAccount(account);
    emit({ status: "authenticated", account });
    return account;
  } catch (error) {
    // 还原，避免用无效 token 继续发请求
    if (previous) await setToken(previous);
    else await clearToken();
    throw error;
  }
}

export async function logout(): Promise<void> {
  await clearToken();
  emit({ status: "guest" });
}

/**
 * 规范化 token。
 * 形如 `xxxx-xxxxx-xxxxx-xxxx-xxxxx-xxxxx-xxxx`，短横线可省略。
 * 用户多半会从网站整段复制，也可能带首尾空白或换行。
 */
export function normalizeToken(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}
