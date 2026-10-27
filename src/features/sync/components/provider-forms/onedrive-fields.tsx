/**
 * OneDrive 的表单字段：应用 ID + 账号连接。
 */

import { Input, Label, TextField } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import type { ProviderOptions } from "@/features/sync/lib/providers/types";
import {
  ONEDRIVE_ACCOUNT_EMAIL_KEY,
  ONEDRIVE_ACCOUNT_NAME_KEY,
  ONEDRIVE_CLIENT_ID_KEY,
} from "@/features/sync/lib/providers/onedrive/provider";
import { OneDriveConnect, type OneDriveAccountInfo } from "./onedrive-connect";

export interface OneDriveFieldsProps {
  /** 配置 id（刷新令牌按它存） */
  configId: string;
  options: ProviderOptions;
  onChange: (options: ProviderOptions) => void;
}

export function OneDriveFields({ configId, options, onChange }: OneDriveFieldsProps): JSX.Element {
  const { t } = useTranslation();
  const clientId = options[ONEDRIVE_CLIENT_ID_KEY] ?? "";
  const accountName = options[ONEDRIVE_ACCOUNT_NAME_KEY] ?? "";
  const accountEmail = options[ONEDRIVE_ACCOUNT_EMAIL_KEY] ?? "";

  const setOption = (key: string, value: string): void => {
    onChange({ ...options, [key]: value });
  };

  const onConnected = (account: OneDriveAccountInfo): void => {
    onChange({
      ...options,
      [ONEDRIVE_ACCOUNT_NAME_KEY]: account.name,
      [ONEDRIVE_ACCOUNT_EMAIL_KEY]: account.email,
    });
  };

  const onDisconnected = (): void => {
    onChange({
      ...options,
      [ONEDRIVE_ACCOUNT_NAME_KEY]: "",
      [ONEDRIVE_ACCOUNT_EMAIL_KEY]: "",
    });
  };

  return (
    <View className="gap-3">
      <TextField>
        <Label>{t("sync.onedrive.clientIdLabel")}</Label>
        <Input
          value={clientId}
          onChangeText={(value) => setOption(ONEDRIVE_CLIENT_ID_KEY, value)}
          placeholder={t("sync.onedrive.clientIdPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </TextField>
      <Muted type="body-xs">{t("sync.onedrive.clientIdHint")}</Muted>

      <OneDriveConnect
        configId={configId}
        clientId={clientId}
        account={accountEmail ? { name: accountName, email: accountEmail } : null}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
      />
    </View>
  );
}
