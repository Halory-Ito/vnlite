import { Button, Input, Label, TextField } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { toQR } from "toqr";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import { secretStoreFor } from "../../lib/configs/secrets";
import type { ProviderOptions } from "../../lib/providers/types";
import { startLogin, finishLogin, type QuarkLogin } from "../../lib/providers/quark/auth";
import { openQuarkAuthorization } from "../../lib/providers/quark/authorization-link";

function LoginQr({ url, label }: { url: string; label: string }) {
  const cells = toQR(url),
    size = Math.sqrt(cells.length);
  let path = "";
  cells.forEach((dark, index) => {
    if (dark) path += `M${(index % size) + 4},${Math.floor(index / size) + 4}h1v1h-1z`;
  });
  return (
    <View className="w-full max-w-64 self-center aspect-square" accessibilityLabel={label}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${size + 8} ${size + 8}`}>
        <Path d={`M0 0h${size + 8}v${size + 8}H0z`} fill="white" />
        <Path d={path} fill="black" />
      </Svg>
    </View>
  );
}
export function QuarkFields({
  id,
  options,
  onChange,
}: {
  id: string;
  options: ProviderOptions;
  onChange: (options: ProviderOptions) => void;
}) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [login, setLogin] = useState<QuarkLogin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void secretStoreFor(id)
      .get("quarkCookieSlot")
      .then((value) => {
        if (mounted.current) setConnected(!!value);
      })
      .catch(() => {
        if (mounted.current) setError(t("sync.quark.authFailed"));
      });
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [id, t]);
  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setLogin(null);
    setBusy(false);
  };
  const begin = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError(null);
    setLogin(null);
    try {
      const pending = await startLogin(current.signal);
      if (current.signal.aborted) return;
      setLogin(pending);
      void openQuarkAuthorization(pending.url).catch(() => {
        if (!current.signal.aborted && mounted.current) setError(t("sync.quark.openFailed"));
      });
      await finishLogin(
        { provider: "quark", configId: id, options, secrets: secretStoreFor(id) },
        pending,
        current.signal
      );
      if (!current.signal.aborted && mounted.current) {
        setConnected(true);
        setLogin(null);
      }
    } catch (err) {
      if (!current.signal.aborted && mounted.current)
        setError(err instanceof Error ? err.message : t("sync.quark.authFailed"));
    } finally {
      if (controller.current === current && mounted.current) {
        setBusy(false);
        setLogin(null);
      }
    }
  };
  return (
    <View className="gap-3">
      <TextField>
        <Label>{t("sync.quark.directory")}</Label>
        <Input
          value={options.directory ?? "vnlite"}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(directory) => onChange({ ...options, directory })}
        />
      </TextField>
      {!login ? (
        <Button variant="secondary" isDisabled={busy} onPress={() => void begin()}>
          <Button.Label>
            {t(
              busy ? "common.loading" : connected ? "sync.quark.reconnect" : "sync.quark.authorize"
            )}
          </Button.Label>
        </Button>
      ) : (
        <>
          <Button
            onPress={() =>
              void openQuarkAuthorization(login.url).catch(() => {
                if (mounted.current) setError(t("sync.quark.openFailed"));
              })
            }
          >
            <Button.Label>{t("sync.quark.openAuthorization")}</Button.Label>
          </Button>
          <LoginQr url={login.url} label={t("sync.quark.qrLabel")} />
          <Button variant="ghost" onPress={cancel}>
            <Button.Label>{t("common.cancel")}</Button.Label>
          </Button>
        </>
      )}
      {connected ? <Muted type="body-xs">{t("sync.quark.connected")}</Muted> : null}
      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}
    </View>
  );
}
