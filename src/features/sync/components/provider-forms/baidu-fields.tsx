import { Button, Input, Label, TextField } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import { secretStoreFor } from "../../lib/configs/secrets";
import type { ProviderOptions } from "../../lib/providers/types";
import { authorize, authorizationUrl } from "../../lib/providers/baidu/oauth";

export function BaiduFields({
  id,
  options,
  onChange,
}: {
  id: string;
  options: ProviderOptions;
  onChange: (options: ProviderOptions) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void secretStoreFor(id)
      .get("refreshToken")
      .then((value) => {
        if (active) setConnected(!!value);
      })
      .catch(() => {
        if (active) setError(t("sync.baidu.authFailed"));
      });
    return () => {
      active = false;
    };
  }, [id, t]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sync.baidu.authFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="gap-3">
      <TextField>
        <Label>{t("sync.baidu.directory")}</Label>
        <Input
          value={options.rootPath ?? "/apps/vnlite"}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(rootPath) => onChange({ ...options, rootPath })}
        />
      </TextField>
      <Button
        variant="secondary"
        isDisabled={busy}
        onPress={() =>
          void run(async () => {
            await Linking.openURL(authorizationUrl());
          })
        }
      >
        <Button.Label>
          {t(connected ? "sync.baidu.reconnect" : "sync.baidu.openAuthorization")}
        </Button.Label>
      </Button>
      <TextField>
        <Label>{t("sync.baidu.code")}</Label>
        <Input
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </TextField>
      <Button
        isDisabled={busy || !code.trim()}
        onPress={() =>
          void run(async () => {
            await authorize(
              { provider: "baidunetdisk", configId: id, options, secrets: secretStoreFor(id) },
              code
            );
            setCode("");
            setConnected(true);
          })
        }
      >
        <Button.Label>{t("sync.baidu.connect")}</Button.Label>
      </Button>
      {connected ? <Muted type="body-xs">{t("sync.baidu.connected")}</Muted> : null}
      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}
    </View>
  );
}
