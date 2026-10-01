/**
 * 账号页：未登录时粘贴 Token，已登录时展示账号信息并提供退出。
 *
 * 登录流程（Q1 = 粘贴 Token）：
 *   粘贴 token → `/authinfo` 校验 → 拿到 id / username / permissions。
 * 校验失败只在本地展示错误，不污染存储（见 `lib/storage/session.ts`）。
 */

import * as Linking from "expo-linking";
import { Button, Input, Typography } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { H5, Muted } from "@/components/typo";
import { TOKEN_CREATE_URL } from "@/constants/config";
import { SettingsShell } from "@/features/settings/components/settings-shell";
import { useSession } from "@/hooks/use-session";
import { ApiError } from "@/lib/api/errors";
import { loginWithToken, logout, type Account } from "@/lib/storage/session";

export default function AccountScreen(): JSX.Element {
  const session = useSession();

  return (
    <SettingsShell title="账号">
      {session.status === "authenticated" ? <SignedIn account={session.account} /> : <SignedOut />}
    </SettingsShell>
  );
}

function SignedOut(): JSX.Element {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginWithToken(token);
      setToken("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : "登录失败"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3 px-4 py-3">
      <Muted type="body-sm">
        粘贴 VNDB Token 以启用清单功能。Token 相当于密码，请只从官网创建。
      </Muted>

      <Button
        size="sm"
        variant="secondary"
        onPress={() => void Linking.openURL(TOKEN_CREATE_URL)}
        className="self-start"
      >
        <Button.Label>前往 vndb.org 创建 Token</Button.Label>
      </Button>

      <Input
        value={token}
        onChangeText={setToken}
        placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      {error ? (
        <Muted type="body-xs" className="text-danger-soft-foreground">
          {error}
        </Muted>
      ) : null}

      <Button
        size="sm"
        onPress={() => void doLogin()}
        isDisabled={busy || token.trim().length === 0}
      >
        <Button.Label>{busy ? "验证中…" : "登录"}</Button.Label>
      </Button>

      <Muted type="body-xs">需要勾选 listread（读私有清单）与 listwrite（写清单）</Muted>
    </View>
  );
}

function SignedIn({ account }: { account: Account }): JSX.Element {
  // 权限块暂时停用（Master 注释掉了），这行也跟着停用，别让 lint 报未使用
  // const canWrite = account.permissions.includes("listwrite");

  return (
    <View>
      <View className="items-center gap-1.5 px-4 py-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Typography type="h3" className="text-accent">
            {account.username.slice(0, 1).toUpperCase()}
          </Typography>
        </View>
        <H5>{account.username}</H5>
        <Muted type="body-xs">ID {account.userId}</Muted>
      </View>

      {/*<View className="gap-1.5 px-4 py-3">
        <Muted type="body-xs" className="font-medium">
          权限
        </Muted>
        <Muted type="body-sm">
          {account.permissions.length > 0 ? account.permissions.join(" · ") : "仅公开数据"}
        </Muted>
        {!canWrite ? (
          <Muted type="body-xs" className="text-warning-soft-foreground">
            缺少 listwrite 权限，无法写入清单。去 vndb.org 的 Token 设置里勾选后重新登录。
          </Muted>
        ) : null}
      </View>*/}

      <View className="px-4 py-6">
        <Button size="sm" variant="danger-soft" onPress={() => void logout()}>
          <Button.Label>退出登录</Button.Label>
        </Button>
      </View>
    </View>
  );
}
