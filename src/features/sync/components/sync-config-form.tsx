/**
 * 新建 / 编辑一份同步配置的表单。
 *
 * 结构：配置名称 → 服务（`Select`）→ 各家自己的字段 → 保存。
 *
 * ## 密钥不进表单的 state 之外
 *
 * 密码只在这里编辑，提交时写进 SecureStore（`configs/secrets`），
 * 配置本体（AsyncStorage）里只有地址、用户名、应用 ID 这些不敏感的东西。
 */

import { Button, Input, Label, Select, TextField } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { OneDriveFields } from "@/features/sync/components/provider-forms/onedrive-fields";
import { WebDavFields } from "@/features/sync/components/provider-forms/webdav-fields";
import { secretStoreFor } from "@/features/sync/lib/configs/secrets";
import { createConfigId, type SyncConfig } from "@/features/sync/lib/configs/types";
import { getProvider, SYNC_PROVIDERS } from "@/features/sync/lib/providers/registry";
import type { ProviderOptions, SyncProviderId } from "@/features/sync/lib/providers/types";
import { WEBDAV_PASSWORD_KEY } from "@/features/sync/lib/providers/webdav/provider";
import { useTranslation } from "@/hooks/use-translation";

export interface SyncConfigFormValues {
  id: string;
  name: string;
  provider: SyncProviderId;
  /** 已规范化的选项 */
  options: ProviderOptions;
}

export interface SyncConfigFormProps {
  /** 编辑已有配置；新建传 null */
  initial: SyncConfig | null;
  /** 保存中 */
  saving: boolean;
  /** 提交（校验通过后调用） */
  onSubmit: (values: SyncConfigFormValues) => void;
  /** 删除这份配置（仅编辑时有） */
  onDelete: (() => void) | null;
  /** 关闭表单 */
  onClose: () => void;
}

export function SyncConfigForm({
  initial,
  saving,
  onSubmit,
  onDelete,
  onClose,
}: SyncConfigFormProps): JSX.Element {
  const { t } = useTranslation();
  const [id] = useState(() => initial?.id ?? createConfigId());
  const [name, setName] = useState(initial?.name ?? "");
  const [providerId, setProviderId] = useState<SyncProviderId>(initial?.provider ?? "webdav");
  const [options, setOptions] = useState<ProviderOptions>(initial?.options ?? {});
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 编辑已有配置时把存的密码读出来（新建时没有密码可读）
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    void (async () => {
      const stored = await secretStoreFor(initial.id).get(WEBDAV_PASSWORD_KEY);
      if (cancelled) return;
      setPassword(stored ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const providerOptions = SYNC_PROVIDERS.map((meta) => ({
    value: meta.id,
    label: meta.implemented ? t(meta.labelKey) : `${t(meta.labelKey)} · ${t("sync.comingSoon")}`,
  }));
  const selected =
    providerOptions.find((option) => option.value === providerId) ?? providerOptions[0];

  const submit = async (): Promise<void> => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("sync.nameRequired"));
      return;
    }
    const provider = getProvider(providerId);
    if (!provider) {
      setError(t("sync.providerNotReady"));
      return;
    }
    const result = provider.validate(options);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // 密码改动过才写 —— 空的密码 = 删掉（有些服务器允许匿名）
    if (providerId === "webdav" && passwordTouched) {
      const store = secretStoreFor(id);
      if (password) await store.set(WEBDAV_PASSWORD_KEY, password);
      else await store.remove(WEBDAV_PASSWORD_KEY);
    }
    onSubmit({ id, name: trimmed, provider: providerId, options: result.options });
  };

  return (
    <View className="gap-4 pb-2">
      <TextField>
        <Label>{t("sync.configNameLabel")}</Label>
        <Input
          value={name}
          onChangeText={setName}
          placeholder={t("sync.configNamePlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </TextField>

      <View className="gap-2">
        <Label>{t("sync.serviceLabel")}</Label>
        <Select
          value={selected}
          onValueChange={(option) => {
            const first = Array.isArray(option) ? option[0] : option;
            if (first) setProviderId(first.value as SyncProviderId);
          }}
        >
          <Select.Trigger className="w-full">
            <Select.Value placeholder={selected.label} />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              {providerOptions.map((option) => (
                <Select.Item key={option.value} value={option.value} label={option.label} />
              ))}
            </Select.Content>
          </Select.Portal>
        </Select>
      </View>

      {providerId === "webdav" ? (
        <WebDavFields
          options={options}
          onChange={setOptions}
          password={password}
          onChangePassword={(value) => {
            setPassword(value);
            setPasswordTouched(true);
          }}
        />
      ) : null}

      {providerId === "onedrive" ? (
        <OneDriveFields configId={id} options={options} onChange={setOptions} />
      ) : null}

      {providerId !== "webdav" && providerId !== "onedrive" ? (
        <Muted type="body-xs">{t("sync.providerNotReady")}</Muted>
      ) : null}

      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}

      <View className="flex-row justify-end gap-2">
        {onDelete ? (
          <Button size="sm" variant="danger-soft" onPress={onDelete}>
            <Button.Label>{t("sync.deleteConfig")}</Button.Label>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onPress={onClose} isDisabled={saving}>
          <Button.Label>{t("common.cancel")}</Button.Label>
        </Button>
        <Button size="sm" onPress={() => void submit()} isDisabled={saving}>
          <Button.Label>{saving ? t("common.loading") : t("sync.save")}</Button.Label>
        </Button>
      </View>
    </View>
  );
}
