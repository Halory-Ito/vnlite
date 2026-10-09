/**
 * 游戏计时的系统通知（Notifee）。
 *
 * ⚠️ 依赖原生模块 `@notifee/react-native`，**Expo Go 不支持**，需要 EAS 开发构建。
 *
 * ⚠️ 必须**懒加载 + try/catch**：Notifee 入口在拿不到原生模块时会在加载时就抛
 * `Notifee native module not found`，静态 import 会让 `_layout` 整个模块求值失败
 * （表现为「route 缺少 default export」）。
 *
 * 这里用 `require()` 而不是 `await import()`：Metro 对 Notifee 这种 CJS 模块的
 * 动态 import 互操作不可靠（实测 `mod.default` 为 undefined），`require` 直接拿到
 * `module.exports`（含 `.default` 与各命名枚举）。
 *
 * 效果（Android）：常驻通知显示游戏封面大图 + 名称 + 计时 + 「暂停 / 继续」
 * 「结束」两个按钮，锁屏可见（`visibility: PUBLIC`）；Android 12+ 折叠时也能点到按钮。
 *
 * 后台保活靠系统悬浮球的**前台服务**（`overlay-window.ts`）—— 它让 JS 运行时
 * 在 App 退到后台时仍活着，通知才能每秒刷新、按钮才即时生效。
 */

import type { Event } from "@notifee/react-native";
import { NativeModules } from "react-native";

import { finishGameTimer } from "./actions";
import { formatGameDuration } from "./format";
import { elapsedMs, getGameTimer, subscribeGameTimer, toggleGameTimerPause } from "./store";

type NotifeeModule = typeof import("@notifee/react-native");

const CHANNEL_ID = "game-timer";
const NOTIFICATION_ID = "game-timer";
/** Notifee 原生模块名（它内部走 `NativeModules[...]`，见 NotifeeNativeModule） */
const NATIVE_MODULE_NAME = "NotifeeApiModule";

/** undefined = 还没试过；null = 试过但原生模块不存在 */
let notifee: NotifeeModule | null | undefined;
let intervalId: ReturnType<typeof setInterval> | null = null;
let initialized = false;

/**
 * 先探测原生模块是否注册，再 require JS 包。
 *
 * 直接 require 的话，模块工厂会在加载时抛 `Notifee native module not found`；
 * 虽然能 try/catch 住，但 Metro 在 dev 下仍会把它报进 LogBox（红屏）。
 * 探测一次 `NativeModules` 就可以在 Expo Go 里完全避开这个模块。
 */
function hasNotifeeNativeModule(): boolean {
  try {
    return NativeModules[NATIVE_MODULE_NAME] != null;
  } catch {
    return false;
  }
}

function getNotifee(): NotifeeModule | null {
  if (notifee !== undefined) return notifee;
  if (!hasNotifeeNativeModule()) {
    notifee = null;
    return notifee;
  }
  try {
    notifee = require("@notifee/react-native") as NotifeeModule;
  } catch {
    notifee = null;
  }
  return notifee;
}

/** 启动通知同步：订阅计时状态 + 处理通知按钮事件。返回取消函数 */
export function initGameTimerNotification(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const mod = getNotifee();
  let unsubscribeEvent: (() => void) | null = null;

  if (mod) {
    void setup(mod)
      .then((unsubscribe) => {
        unsubscribeEvent = unsubscribe;
      })
      .catch(() => {
        // 原生调用异常时静默，不影响 App
      });
  }
  const unsubscribeStore = subscribeGameTimer(() => void syncNotification());
  void syncNotification();

  return () => {
    unsubscribeStore();
    unsubscribeEvent?.();
    stopInterval();
    initialized = false;
  };
}

/** 建渠道 + 申请权限 + 注册按钮事件 */
async function setup(mod: NotifeeModule): Promise<() => void> {
  const api = mod.default;
  try {
    await api.requestPermission();
    await api.createChannel({
      id: CHANNEL_ID,
      name: "游戏计时",
      importance: mod.AndroidImportance.LOW,
    });
    const unsubscribe = api.onForegroundEvent(handleEvent);
    api.onBackgroundEvent(async (event) => {
      handleEvent(event);
    });
    void syncNotification();
    return unsubscribe;
  } catch {
    // 权限被拒 / 原生调用异常：不影响 App，也不显示通知
    return () => {};
  }
}

/** 通知按钮：暂停 / 继续、结束 */
function handleEvent(event: Event): void {
  const mod = getNotifee();
  if (!mod || event.type !== mod.EventType.ACTION_PRESS) return;
  const id = event.detail.pressAction?.id;
  if (id === "toggle") toggleGameTimerPause();
  else if (id === "stop") finishGameTimer();
}

/** 依据当前状态刷新 / 关闭通知，并管理秒级刷新 */
async function syncNotification(): Promise<void> {
  const state = getGameTimer();
  if (state.status === "idle") {
    stopInterval();
    await hideNotification();
    return;
  }
  await displayNotification();
  if (state.status === "running") startInterval();
  else stopInterval();
}

function startInterval(): void {
  if (intervalId != null) return;
  intervalId = setInterval(() => void displayNotification(), 1000);
}

function stopInterval(): void {
  if (intervalId == null) return;
  clearInterval(intervalId);
  intervalId = null;
}

async function displayNotification(): Promise<void> {
  const mod = getNotifee();
  if (!mod) return;
  const state = getGameTimer();
  if (state.status === "idle") return;
  const paused = state.status === "paused";
  const time = formatGameDuration(elapsedMs(state, Date.now()));

  try {
    await mod.default.displayNotification({
      id: NOTIFICATION_ID,
      title: state.vnTitle || "游戏计时",
      body: paused ? `${time} · 已暂停` : time,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: "ic_launcher",
        largeIcon: state.coverUrl ?? undefined,
        ongoing: true,
        onlyAlertOnce: true,
        showTimestamp: false,
        visibility: mod.AndroidVisibility.PUBLIC,
        pressAction: { id: "open" },
        actions: [
          { title: paused ? "继续" : "暂停", pressAction: { id: "toggle" } },
          { title: "结束", pressAction: { id: "stop" } },
        ],
      },
      ios: { categoryId: CHANNEL_ID },
    });
  } catch {
    // 原生模块缺失 / 显示失败时静默
  }
}

async function hideNotification(): Promise<void> {
  const mod = getNotifee();
  if (!mod) return;
  try {
    await mod.default.cancelNotification(NOTIFICATION_ID);
  } catch {
    // 静默
  }
}
