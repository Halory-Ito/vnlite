/**
 * 账号页：未登录时粘贴 Token，已登录时展示账号信息并提供退出。
 *
 * 登录流程（Q1 = 粘贴 Token）：
 *   粘贴 token → `/authinfo` 校验 → 拿到 id / username / permissions。
 * 校验失败只在本地展示错误，不污染存储（见 `lib/storage/session.ts`）。
 */

import * as Linking from "expo-linking";
import { Button, Input, Label, TextField, Typography } from "heroui-native";
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
    // 未登录时表单只有一两个控件，顶部对齐看起来很空 —— 整块垂直居中
    <SettingsShell title="账号" centerContent>
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
    /*
     * 布局（Master 要求：不额外加内容，只调排版）：
     *   - `self-center` + `max-w-sm`：`maxWidth` 会让 flex 子元素从「拉伸」退化成
     *     「靠左」，必须显式 `alignSelf: center` 才是真的水平居中（平板上才看得出）
     *   - `flex-1 justify-center`：整块表单落在剩余空间的垂直正中
     *   - `gap-3`：`TextField` 内部已经处理了 Label 与 Input 的间距，
     *     外层只需要把「错误文案 / 按钮」跟输入框分开
     */
    <View className="w-full max-w-sm flex-1 self-center justify-center gap-3 px-4">
      <TextField>
        <Label>VNDB Token</Label>
        <Input
          value={token}
          onChangeText={setToken}
          placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </TextField>

      {/* 错误文案占位固定高度：登录失败时按钮不会跟着往下跳 */}
      <View className="min-h-4 justify-center">
        {error ? (
          <Muted type="body-xs" className="text-danger-soft-foreground">
            {error}
          </Muted>
        ) : null}
      </View>

      <View className="mt-1 flex-row gap-3">
        <Button
          size="sm"
          className="flex-1"
          onPress={() => void doLogin()}
          isDisabled={busy || token.trim().length === 0}
        >
          <Button.Label>{busy ? "验证中…" : "登录"}</Button.Label>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onPress={() => void Linking.openURL(TOKEN_CREATE_URL)}
        >
          <Button.Label>获取</Button.Label>
        </Button>
      </View>
    </View>
  );
}

function SignedIn({ account }: { account: Account }): JSX.Element {
  return (
    // 与未登录态同一套容器（同样的 max-w-sm + 居中），两个状态切换时不跳版
    <View className="w-full max-w-sm flex-1 self-center justify-center gap-6 px-4">
      <View className="items-center gap-1.5">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Typography type="h3" className="text-accent">
            {account.username.slice(0, 1).toUpperCase()}
          </Typography>
        </View>
        <H5>{account.username}</H5>
        <Muted type="body-xs">ID {account.userId}</Muted>
      </View>

      <Button size="sm" variant="danger-soft" onPress={() => void logout()}>
        <Button.Label>退出登录</Button.Label>
      </Button>
    </View>
  );
}
