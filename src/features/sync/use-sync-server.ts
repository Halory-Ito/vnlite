/**
 * WebDAV 服务器设置（表单状态 + 落盘）。
 *
 * 地址与用户名进 AsyncStorage，密码进 SecureStore（明文存储密码不可接受）。
 */

import { useCallback, useEffect, useState } from "react";

import {
  clearServerConfig,
  readLastSyncAt,
  readPassword,
  readServerConfig,
  saveServerConfig,
  writePassword,
} from "./server-config";
import { normalizeServerUrl } from "./webdav";

export interface UseSyncServer {
  /** 初始读取中（表单先别渲染，省得闪一下空值） */
  loading: boolean;
  url: string;
  username: string;
  password: string;
  setUrl: (value: string) => void;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  /** 保存；地址不合法时返回 false（调用方提示） */
  save: () => Promise<boolean>;
  /** 清空服务器设置（含密码） */
  clear: () => Promise<void>;
  /** 上次同步成功的时间（unix 毫秒） */
  lastSyncAt: number | null;
  /** 刷新「上次同步」读数 */
  refreshLastSync: () => Promise<void>;
}

export function useSyncServer(): UseSyncServer {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [config, storedPassword, last] = await Promise.all([
        readServerConfig(),
        readPassword(),
        readLastSyncAt(),
      ]);
      if (cancelled) return;
      setUrl(config?.url ?? "");
      setUsername(config?.username ?? "");
      setPassword(storedPassword);
      setLastSyncAt(last);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const normalized = normalizeServerUrl(url);
    if (!normalized) return false;
    await saveServerConfig({ url: normalized, username: username.trim() });
    await writePassword(password);
    setUrl(normalized);
    return true;
  }, [password, url, username]);

  const clear = useCallback(async (): Promise<void> => {
    await clearServerConfig();
    setUrl("");
    setUsername("");
    setPassword("");
  }, []);

  const refreshLastSync = useCallback(async (): Promise<void> => {
    setLastSyncAt(await readLastSyncAt());
  }, []);

  return {
    loading,
    url,
    username,
    password,
    setUrl,
    setUsername,
    setPassword,
    save,
    clear,
    lastSyncAt,
    refreshLastSync,
  };
}
