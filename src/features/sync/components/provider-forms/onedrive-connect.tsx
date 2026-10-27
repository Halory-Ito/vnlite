/**
 * OneDrive 授权（设备码流程的界面部分）。
 *
 * 流程：点「连接」→ 拿到设备码 → 自动打开微软的验证页面 → 用户在网页里输码登录
 * → 应用这边轮询到 token → 把刷新令牌存进 SecureStore。
 *
 * 刷新令牌是唯一的长期凭据：访问令牌只留在内存（见 `providers/onedrive/client`）。
 */

import { Button } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { secretStoreFor } from "@/features/sync/lib/configs/secrets";
import {
  forgetAccessToken,
  ONEDRIVE_REFRESH_KEY,
} from "@/features/sync/lib/providers/onedrive/client";
import {
  fetchAccount,
  pollForToken,
  requestDeviceCode,
} from "@/features/sync/lib/providers/onedrive/oauth";

export interface OneDriveAccountInfo {
  name: string;
  email: string;
}

export interface OneDriveConnectProps {
  /** 配置 id（刷新令牌按它存） */
  configId: string;
  /** Azure 应用 ID */
  clientId: string;
  /** 已连接的账号 */
  account: OneDriveAccountInfo | null;
  /** 连上了 */
  onConnected: (account: OneDriveAccountInfo) => void;
  /** 断开了 */
  onDisconnected: () => void;
}

export function OneDriveConnect({
  configId,
  clientId,
  account,
  onConnected,
  onDisconnected,
}: OneDriveConnectProps): JSX.Element {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"idle" | "waiting" | "error">("idle");
  const [userCode, setUserCode] = useState<string | null>(null);
  /** 验证页面地址：用户关了浏览器还能再打开 */
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  // 页面被关掉时停掉后台轮询（否则会一直问到过期）
  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const start = async (): Promise<void> => {
    setError(null);
    setUserCode(null);
    setAuthUrl(null);
    cancelled.current = false;
    if (!clientId.trim()) {
      setPhase("error");
      setError(t("sync.onedrive.clientIdRequired"));
      return;
    }
    try {
      const info = await requestDeviceCode(clientId.trim());
      if (cancelled.current) return;
      const url = info.verificationUriComplete || info.verificationUri;
      setUserCode(info.userCode);
      setAuthUrl(url);
      setPhase("waiting");
      // 打开验证页面（带码的地址能少输一次）
      await Linking.openURL(url);

      const token = await pollForToken(
        clientId.trim(),
        info.deviceCode,
        info.intervalMs,
        Date.now() + info.expiresInMs,
        () => cancelled.current
      );
      if (!token || cancelled.current) return;

      const connected = await fetchAccount(token.accessToken);
      await secretStoreFor(configId).set(ONEDRIVE_REFRESH_KEY, token.refreshToken);
      forgetAccessToken(configId);
      onConnected(connected);
      setPhase("idle");
      setUserCode(null);
      setAuthUrl(null);
    } catch (err) {
      if (cancelled.current) return;
      setPhase("error");
      setError(err instanceof Error && err.message ? err.message : t("sync.onedrive.authFailed"));
    }
  };

  const cancel = (): void => {
    cancelled.current = true;
    setPhase("idle");
    setUserCode(null);
    setAuthUrl(null);
  };

  const disconnect = async (): Promise<void> => {
    await secretStoreFor(configId).remove(ONEDRIVE_REFRESH_KEY);
    forgetAccessToken(configId);
    onDisconnected();
  };

  return (
    <View className="gap-2">
      {account ? (
        <View className="gap-1">
          <Muted type="body-sm">{account.name}</Muted>
          <Muted type="body-xs">{account.email}</Muted>
        </View>
      ) : null}

      {phase === "waiting" ? (
        <View className="gap-2">
          <Muted type="body-sm">{t("sync.onedrive.deviceCode", { code: userCode ?? "" })}</Muted>
          <Muted type="body-xs">{t("sync.onedrive.deviceCodeHint")}</Muted>
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                if (authUrl) void Linking.openURL(authUrl);
              }}
            >
              <Button.Label>{t("sync.onedrive.openAuthPage")}</Button.Label>
            </Button>
            <Button size="sm" variant="ghost" onPress={cancel}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        </View>
      ) : null}

      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}

      <View className="flex-row gap-2">
        {account ? (
          <>
            <Button size="sm" variant="secondary" onPress={() => void disconnect()}>
              <Button.Label>{t("sync.onedrive.disconnect")}</Button.Label>
            </Button>
            <Button size="sm" variant="ghost" onPress={() => void start()}>
              <Button.Label>{t("sync.onedrive.reconnect")}</Button.Label>
            </Button>
          </>
        ) : (
          <Button size="sm" onPress={() => void start()} isDisabled={phase === "waiting"}>
            <Button.Label>
              {phase === "waiting" ? t("sync.onedrive.connecting") : t("sync.onedrive.connect")}
            </Button.Label>
          </Button>
        )}
      </View>
    </View>
  );
}
