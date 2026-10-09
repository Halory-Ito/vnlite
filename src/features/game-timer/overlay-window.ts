/**
 * 游戏计时 · 系统悬浮球（Android）。
 *
 * ⚠️ 依赖原生模块 `react-native-android-overlay`，**Expo Go 不支持**，需要 EAS
 * 开发构建。iOS 无此能力（系统不允许 App 在别的 App 上画窗口），会静默跳过。
 *
 * 用动态 `import` + try/catch 包住：模块没链接时（Expo Go / iOS）不会崩，
 * 只是这个能力不可用 —— App 内的圆形浮层照常工作。
 *
 * 被显示的组件在 `components/overlay-window-view.tsx`，已通过自定义入口
 * `index.js` 注册为 AppRegistry 组件「GameTimerOverlayWindow」。
 */

import { AppState, TurboModuleRegistry } from "react-native";

import { getGameTimer, subscribeGameTimer } from "./store";

/** 与 index.js 里注册的名字一致 */
const COMPONENT_NAME = "GameTimerOverlayWindow";

/** 悬浮球原生模块名（react-native-android-overlay 的 TurboModule） */
const NATIVE_MODULE_NAME = "AndroidOverlay";

/** 气泡窗口尺寸（DP）：一个圆 + 一点余量 */
const OVERLAY_SIZE = 96;

let shown = false;
let initialized = false;

/** 原生模块没链接时（Expo Go / iOS）直接跳过，避免 import 时就抛错 */
function isOverlayNativeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get(NATIVE_MODULE_NAME) != null;
  } catch {
    return false;
  }
}

/** 订阅计时状态：有计时就显示悬浮球，结束就收起。返回取消函数 */
export function initGameTimerOverlayWindow(): () => void {
  if (initialized) return () => {};
  initialized = true;
  const unsubscribe = subscribeGameTimer(() => void sync());
  // 用户在系统设置里授予「显示在其他应用上层」后返回 App，重试一次
  const appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "active") void sync();
  });
  void sync();
  return () => {
    unsubscribe();
    appStateSub.remove();
    void hideTimerOverlay();
    initialized = false;
  };
}

async function sync(): Promise<void> {
  const active = getGameTimer().status !== "idle";
  if (active && !shown) {
    shown = true;
    await showTimerOverlay();
  } else if (!active && shown) {
    shown = false;
    await hideTimerOverlay();
  }
}

async function showTimerOverlay(): Promise<void> {
  if (!isOverlayNativeAvailable()) {
    shown = false;
    return;
  }
  try {
    const { OverlayManager } = await import("react-native-android-overlay");
    const granted = await OverlayManager.hasPermission();
    if (!granted) {
      // 首次没权限：拉系统设置让用户开「显示在其他应用上层」
      OverlayManager.requestPermission();
      shown = false;
      return;
    }
    OverlayManager.startOverlay(COMPONENT_NAME, {
      width: OVERLAY_SIZE,
      height: OVERLAY_SIZE,
      gravity: "top",
      draggable: true,
      touchable: true,
      focusable: false,
      foreground: true,
      notificationTitle: "游戏计时",
      notificationText: "计时进行中，点按通知可暂停或结束",
      notificationIcon: "ic_launcher",
      channelId: "game-timer",
      channelName: "游戏计时",
    });
  } catch {
    // 原生模块缺失（Expo Go / iOS）时静默降级
    shown = false;
  }
}

async function hideTimerOverlay(): Promise<void> {
  if (!isOverlayNativeAvailable()) return;
  try {
    const { OverlayManager } = await import("react-native-android-overlay");
    OverlayManager.stopOverlay(COMPONENT_NAME);
  } catch {
    // 静默
  }
}
