/**
 * 自定义入口。
 *
 * Expo Router 的自定义入口约定：在项目根建 `index.js`，最后 import
 * `expo-router/entry` 注册 App 主组件（见 Expo Router「Manual installation」）。
 *
 * 这里额外注册系统悬浮球要用的组件「GameTimerOverlayWindow」——
 * `react-native-android-overlay` 只能渲染通过 `AppRegistry` 注册的组件。
 */

import { AppRegistry } from "react-native";

import { GameTimerOverlayWindow } from "./src/features/game-timer/components/overlay-window-view";

AppRegistry.registerComponent("GameTimerOverlayWindow", () => GameTimerOverlayWindow);

// 注册 App 入口（放最后）
import "expo-router/entry";
