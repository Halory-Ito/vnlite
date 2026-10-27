/**
 * 游戏计时的系统通知（expo-notifications）。
 *
 * 用 Expo 官方组件库，替代之前的 `@notifee/react-native`。能做到：
 *   - 常驻、**不可滑动删除**（`content.sticky`，对应 Android `setOngoing`）
 *   - 锁屏可见（频道 `lockscreenVisibility: PUBLIC`）
 *   - 「暂停 / 继续」「结束」两个按钮（分类 `setNotificationCategoryAsync`）
 *   - 每秒就地刷新同一条通知（`scheduleNotificationAsync` 传固定 `identifier`）
 *
 * ⚠️ 必须**懒加载 + 检测 Expo Go**：Android 的 Expo Go 从 SDK 53 起移除了远端通知，
 * `expo-notifications` 在该环境下会抛错（导入 / 调用皆可能），静态 import 会把
 * `_layout` 整个模块带崩（表现为一大串路由错误）。非 Expo Go（开发构建 / 正式包）
 * 才真正 `require`。
 *
 * ⚠️ 取舍：expo-notifications 的 `NotificationContentInput` 没有大图字段，
 * **通知里没有作品封面**（此前 Notifee 有；`attachments` 仅 iOS）。
 *
 * ⚠️ 没有前台服务：App 退到后台 / 被杀后不再每秒刷新通知，但耗时按**时间戳**计算，
 * 回到前台会立刻校准（不会丢时间）；通知本身 `sticky`，不会自己消失。
 */

import { isRunningInExpoGo } from "expo";
import type * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";

import { t } from "@/lib/i18n/translate";

import { finishGameTimer } from "./actions";
import { formatGameDuration } from "./format";
import { elapsedMs, getGameTimer, subscribeGameTimer, toggleGameTimerPause } from "./store";

type NotificationsModule = typeof ExpoNotifications;

const CHANNEL_ID = "game-timer";
const NOTIFICATION_ID = "game-timer-notification";
/** 两个分类：运行中按钮是「暂停」，暂停时是「继续」；都有「结束」 */
const CATEGORY_RUNNING = "game-timer-running";
const CATEGORY_PAUSED = "game-timer-paused";

/** undefined = 还没试过；null = 试过但不可用（Expo Go） */
let notifications: NotificationsModule | null | undefined;
let intervalId: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function getNotifications(): NotificationsModule | null {
  if (notifications !== undefined) return notifications;
  if (isRunningInExpoGo()) {
    // Android Expo Go 会抛「远端通知已移除」，直接跳过（本地通知在该环境也不保证可用）
    notifications = null;
    return notifications;
  }
  try {
    notifications = require("expo-notifications") as NotificationsModule;
  } catch {
    notifications = null;
  }
  return notifications;
}

/** 启动通知同步：订阅计时状态 + 处理通知按钮事件。返回取消函数 */
export function initGameTimerNotification(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const mod = getNotifications();
  let responseSubscription: { remove: () => void } | null = null;

  if (mod) {
    // App 在前台时也要把通知显示出来（否则只有后台才弹）
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    responseSubscription = mod.addNotificationResponseReceivedListener(handleResponse);
    // 冷启动：用户点是通知 / 按钮把 App 拉起来的
    void mod.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });
    void prepare(mod);
  }

  const unsubscribeStore = subscribeGameTimer(() => void syncNotification());
  void syncNotification();

  return () => {
    unsubscribeStore();
    responseSubscription?.remove();
    stopInterval();
    initialized = false;
  };
}

/** 建频道 + 申请权限 + 注册两个按钮分类 */
async function prepare(mod: NotificationsModule): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await mod.setNotificationChannelAsync(CHANNEL_ID, {
        name: t("timer.channel"),
        importance: mod.AndroidImportance.LOW,
        lockscreenVisibility: mod.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: false,
        showBadge: false,
      });
    }
    await mod.requestPermissionsAsync();
    await mod.setNotificationCategoryAsync(CATEGORY_RUNNING, [
      {
        identifier: "toggle",
        buttonTitle: t("timer.pause"),
        options: { opensAppToForeground: false },
      },
      {
        identifier: "stop",
        buttonTitle: t("timer.stop"),
        options: { isDestructive: true, opensAppToForeground: false },
      },
    ]);
    await mod.setNotificationCategoryAsync(CATEGORY_PAUSED, [
      {
        identifier: "toggle",
        buttonTitle: t("timer.resume"),
        options: { opensAppToForeground: false },
      },
      {
        identifier: "stop",
        buttonTitle: t("timer.stop"),
        options: { isDestructive: true, opensAppToForeground: false },
      },
    ]);
  } catch {
    // 权限被拒等：静默，不影响 App 其余功能
  }
  void syncNotification();
}

/** 通知按钮：暂停 / 继续、结束（点通知本体是 DEFAULT_ACTION_IDENTIFIER，不处理） */
function handleResponse(response: ExpoNotifications.NotificationResponse): void {
  const id = response.actionIdentifier;
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
  const mod = getNotifications();
  if (!mod) return;
  const state = getGameTimer();
  if (state.status === "idle") return;
  const paused = state.status === "paused";
  const time = formatGameDuration(elapsedMs(state, Date.now()));

  try {
    await mod.scheduleNotificationAsync({
      // 固定 identifier：再次 schedule 会就地更新同一条，不新增
      identifier: NOTIFICATION_ID,
      content: {
        title: state.vnTitle || t("timer.notificationTitle"),
        body: paused ? t("timer.notificationPaused", { time }) : time,
        sticky: true,
        autoDismiss: false,
        categoryIdentifier: paused ? CATEGORY_PAUSED : CATEGORY_RUNNING,
        data: { gameTimer: true },
      },
      // Android 需要指定频道；立即投递用 ChannelAwareTriggerInput
      trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    // 显示失败时静默
  }
}

async function hideNotification(): Promise<void> {
  const mod = getNotifications();
  if (!mod) return;
  try {
    await mod.dismissNotificationAsync(NOTIFICATION_ID);
    await mod.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // 静默
  }
}
