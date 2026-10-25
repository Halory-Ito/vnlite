/**
 * WebDAV 服务器设置表单。
 *
 * 地址 / 用户名 / 密码三个字段 + 保存按钮。密码是密文输入，
 * 落盘走 SecureStore（见 `../server-config`）。
 */

import { Button, Input, Label, TextField } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

export interface SyncServerFormProps {
  url: string;
  username: string;
  password: string;
  onChangeUrl: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSave: () => void;
  /** 正在保存 */
  saving: boolean;
  /** 地址不合法时的提示 */
  error: string | null;
}

export function SyncServerForm({
  url,
  username,
  password,
  onChangeUrl,
  onChangeUsername,
  onChangePassword,
  onSave,
  saving,
  error,
}: SyncServerFormProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <TextField>
        <Label>{t("sync.urlLabel")}</Label>
        <Input
          value={url}
          onChangeText={onChangeUrl}
          placeholder={t("sync.urlPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </TextField>

      <TextField>
        <Label>{t("sync.usernameLabel")}</Label>
        <Input
          value={username}
          onChangeText={onChangeUsername}
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

      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}

      <Button size="sm" onPress={onSave} isDisabled={saving}>
        <Button.Label>{saving ? t("common.loading") : t("sync.save")}</Button.Label>
      </Button>
    </View>
  );
}
