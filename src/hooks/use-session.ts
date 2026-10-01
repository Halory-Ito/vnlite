/**
 * 登录态的 React 绑定。
 *
 * `lib/storage/session.ts` 里是一个模块级单例 + 订阅者，
 * 这里用 `useSyncExternalStore` 接到 React 树上。
 */

import { useSyncExternalStore } from "react";

import {
  getSession,
  hasPermission,
  subscribeSession,
  type SessionState,
} from "@/lib/storage/session";

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}

export function useIsLoggedIn(): boolean {
  return useSession().status === "authenticated";
}

/** 是否具备某项权限。游客态与加载中一律返回 false */
export function usePermission(permission: "listread" | "listwrite"): boolean {
  const session = useSession();
  if (session.status !== "authenticated") return false;
  return hasPermission(permission);
}
