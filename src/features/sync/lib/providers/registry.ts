/**
 * 供应商清单。
 *
 * 「新建配置」时的服务下拉列表读这里；
 * 包含 WebDAV、百度网盘与夸克网盘。
 */

import type { SyncProvider, SyncProviderId, SyncProviderMeta } from "./types";
import { WEBDAV_PROVIDER } from "./webdav/provider";
import { QUARK_PROVIDER } from "./quark/provider";
import { BAIDU_PROVIDER } from "./baidu/provider";

/** 服务下拉列表的顺序 */
export const SYNC_PROVIDERS: SyncProviderMeta[] = [
  WEBDAV_PROVIDER.meta,
  BAIDU_PROVIDER.meta,
  QUARK_PROVIDER.meta,
];

const IMPLEMENTED: Partial<Record<SyncProviderId, SyncProvider>> = {
  webdav: WEBDAV_PROVIDER,
  baidunetdisk: BAIDU_PROVIDER,
  quark: QUARK_PROVIDER,
};

/** 取供应商实现；没实现的那几家返回 null */
export function getProvider(id: SyncProviderId): SyncProvider | null {
  return IMPLEMENTED[id] ?? null;
}

/** 这家是不是已经能用了 */
export function isProviderReady(id: SyncProviderId): boolean {
  return getProvider(id) !== null;
}
