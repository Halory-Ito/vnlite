import type { JSX } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { queryClient } from "@/lib/query/client";
import { restoreSession } from "@/lib/storage/session";
import { ThemeProvider } from "@/theme/theme-provider";

import "../global.css";

export default function RootLayout(): JSX.Element {
  // 冷启动恢复登录态：读 SecureStore 的 token → /authinfo 校验 → 写本地 account 表。
  // 清单数据不落库（服务端直读），所以这里没有清单同步要做
  useEffect(() => {
    void restoreSession();
  }, []);

  /*
   * ⚠️ 这里**不能**给 Stack 传不透明的 `backgroundColor`。
   *
   * `Stack` 渲染在 `ThemeProvider` 内部，但它的屏幕容器是**不透明**的 ——
   * 一旦刷上 `background`，`ThemeProvider` 铺在最底层的背景图就被整个盖住，
   * 表现为「切了主题但看不见背景图」（实际踩过两次的坑）。
   *
   * 所以：底色由 `AppBackground` 的第一层提供，导航容器一律透明。
   * 转场时透出的也是这层底色，不是系统窗口色，白屏问题一并解决。
   */

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <QueryClientProvider client={queryClient}>
            {/* 主题包在最内层：要在所有页面之前完成配色与背景的注入 */}
            <ThemeProvider>
              <SafeAreaScreen>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "transparent" },
                    animation: "slide_from_right",
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                </Stack>
                <StatusBar style="auto" />
              </SafeAreaScreen>
            </ThemeProvider>
          </QueryClientProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * 全局安全区。
 *
 * 之前各页面用 `pt-6` 硬绕，结果在刘海屏上顶部仍然被遮住。
 * 这里统一在最外层处理，只补 `top` —— `bottom` 交给 Tab Bar 自己
 * （它已经画在安全区内，再补一层会多出空白）。
 *
 * 背景必须**透明**：安全区 padding 区在页面内容之外，它是不透明的话
 * 刘海屏顶部会压出一条盖住背景图的色块（Android 上还会露默认窗口色）。
 * 底下已经有 `AppBackground` 的底色层兜底，这里不需要再刷一次。
 */
function SafeAreaScreen({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      {children}
    </SafeAreaView>
  );
}
