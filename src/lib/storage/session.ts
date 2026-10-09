/**
 * 登录态管理。
 *
 * 流程（Q1 = A：粘贴 Token）：
 *   1. 用户在设置页粘贴 token
 *   2. 调 `GET /authinfo` 验证，同时拿到 id / username / permissions
 *   3. 验证通过后写入本地 `account` 表（Token 已在步骤 2 前存入 SecureStore）
 *
 * Token 只在两种情况下才会被删除：用户主动退出，或服务端返回 401。
 * 超时 / 断网等一律保留。
 *
 * 权限判断：读私有清单需要 `listread`，写清单需要 `listwrite`。
 * 两者都没有就只能当游客浏览。
 */

import { setTokenProvider, type TokenProvider } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { authInfo } from "@/lib/api/endpoints/ulist";
import { clearAccount, getAccount, upsertAccount } from "@/lib/db/dao/account";

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
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; account: Account };

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

/**
 * 服务端返回 401（Token 失效 / 被用户在 vndb.org 删除）时的统一处理。
 *
 * 这是除「用户主动退出」外**唯一**允许删除 Token 的入口。超时 / 断网 / 5xx
 * 一律不走这里，Token 会被保留。
 */
export async function handleUnauthorized(): Promise<void> {
  await clearToken();
  await clearAccount();
  emit({ status: "guest" });
}

/**
 * 应用启动时调用：读本地 token 并校验。
 *
 * Token 生命周期（Master 规则）：
 *   - **只有 401** 才代表 Token 真的失效（用户在 vndb.org 上删了），此时才允许
 *     在本地删除 Token 与账号缓存；
 *   - 超时 / 断网 / 5xx 等一律**保留** Token，避免网络抖动误删有效 Token。
 *
 * authinfo 只负责校准账号信息：非 401 失败时，只要本地有缓存账号就继续维持登录，
 * 避免把用户踢成游客。
 */
export async function restoreSession(): Promise<SessionState> {
  const token = await getToken();
  if (!token) {
    emit({ status: "guest" });
    return current;
  }

  // 先用缓存账号乐观进入登录态，再异步校准
  const cached = await getAccount();
  if (cached) emit({ status: "authenticated", account: cached });

  try {
    const info = await authInfo();
    const account: Account = {
      userId: info.id,
      username: info.username,
      permissions: info.permissions ?? [],
      // 沿用首次登录时间，不要每次冷启动都覆盖
      loggedInAt: cached?.loggedInAt ?? Date.now(),
    };
    await upsertAccount(account);
    emit({ status: "authenticated", account });
  } catch (error) {
    if (error instanceof ApiError && error.needsAuth) {
      // 401：Token 确实失效，删掉并退回游客
      await handleUnauthorized();
    } else if (!cached) {
      // 非 401（超时 / 断网等）：保留 Token，下次启动再用它重试
      emit({ status: "guest" });
    }
    // 非 401 且有缓存账号：维持上面已进入的登录态
  }
  return current;
}

/**
 * 校验并登录。
 *
 * Token 生命周期（Master 规则）：只有 401 才允许删除 Token，其它失败一律保留。
 *   - 已有旧 Token（换 Token 场景）：任何失败都还原旧 Token，绝不删除；
 *   - 没有旧 Token：401 说明刚输入的这个 Token 无效 → 清掉；超时 / 断网则保留，
 *     留给下次冷启动重新校验。
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
    if (previous) {
      // 换 Token 失败：还原旧 Token
      await setToken(previous);
    } else if (error instanceof ApiError && error.needsAuth) {
      // 401：刚输入的 Token 被否决，清掉
      await handleUnauthorized();
    }
    // 非 401 且没有旧 Token：保留本次输入的 Token，交给下次冷启动校验
    throw error;
  }
}

/** 用户主动退出：清除 Token 与账号缓存 */
export async function logout(): Promise<void> {
  await clearToken();
  await clearAccount();
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
