/**
 * 供应商清单。
 *
 * 「新建配置」时的服务下拉列表读这里；
 * 已实现的两家（WebDAV / OneDrive）在这里挂上真正的实现。
 *
 * 未实现的（GoogleDrive / 夸克网盘）只占位：列表里能看到，但选了不能保存 ——
 * 先把位置留好，以后接上只要加一个 `provider.ts`。
 */

import { ONEDRIVE_PROVIDER } from "./onedrive/provider";
import type { SyncProvider, SyncProviderId, SyncProviderMeta } from "./types";
import { WEBDAV_PROVIDER } from "./webdav/provider";

/** 服务下拉列表的顺序 */
export const SYNC_PROVIDERS: SyncProviderMeta[] = [
  WEBDAV_PROVIDER.meta,
  ONEDRIVE_PROVIDER.meta,
  { id: "googledrive", labelKey: "sync.provider.googleDrive", implemented: false },
  { id: "quark", labelKey: "sync.provider.quark", implemented: false },
];

const IMPLEMENTED: Partial<Record<SyncProviderId, SyncProvider>> = {
  webdav: WEBDAV_PROVIDER,
  onedrive: ONEDRIVE_PROVIDER,
};

/** 取供应商实现；没实现的那几家返回 null */
export function getProvider(id: SyncProviderId): SyncProvider | null {
  return IMPLEMENTED[id] ?? null;
}

/** 这家是不是已经能用了 */
export function isProviderReady(id: SyncProviderId): boolean {
  return getProvider(id) !== null;
}
