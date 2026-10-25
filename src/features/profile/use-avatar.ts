/**
 * 头像状态的 React 绑定。
 *
 * `features/profile/avatar.ts` 里是模块级快照 + 订阅者，
 * 这里用 `useSyncExternalStore` 接到 React 树上（与偏好、登录态同一套做法）。
 */

import { useSyncExternalStore } from "react";

import { getAvatarUri, subscribeAvatar } from "./avatar";

/** 本地头像的文件 URI；没设头像时是 null */
export function useAvatar(): string | null {
  return useSyncExternalStore(subscribeAvatar, getAvatarUri, getAvatarUri);
}
