/**
 * WebDAV 的表单字段：服务器地址 / 用户名 / 密码。
 *
 * 密码是密文输入，落盘走 SecureStore（见 `configs/secrets`）。
 */

import { Input, Label, TextField } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { useTranslation } from "@/hooks/use-translation";

import type { ProviderOptions } from "@/features/sync/lib/providers/types";
import { WEBDAV_URL_KEY, WEBDAV_USERNAME_KEY } from "@/features/sync/lib/providers/webdav/provider";

export interface WebDavFieldsProps {
  options: ProviderOptions;
  onChange: (options: ProviderOptions) => void;
  password: string;
  onChangePassword: (value: string) => void;
}

export function WebDavFields({
  options,
  onChange,
  password,
  onChangePassword,
}: WebDavFieldsProps): JSX.Element {
  const { t } = useTranslation();

  const setOption = (key: string, value: string): void => {
    onChange({ ...options, [key]: value });
  };

  return (
    <View className="gap-3">
      <TextField>
        <Label>{t("sync.urlLabel")}</Label>
        <Input
          value={options[WEBDAV_URL_KEY] ?? ""}
          onChangeText={(value) => setOption(WEBDAV_URL_KEY, value)}
          placeholder={t("sync.urlPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </TextField>

      <TextField>
        <Label>{t("sync.usernameLabel")}</Label>
        <Input
          value={options[WEBDAV_USERNAME_KEY] ?? ""}
          onChangeText={(value) => setOption(WEBDAV_USERNAME_KEY, value)}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </TextField>

      <TextField>
        <Label>{t("sync.passwordLabel")}</Label>
        <Input
          value={password}
          onChangeText={onChangePassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </TextField>
    </View>
  );
}
