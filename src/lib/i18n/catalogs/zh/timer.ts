/**
 * 简体中文 · timer 模块（游戏计时按钮 / 浮层 / 系统通知）。
 *
 * 接入点：`features/game-timer/components/*`、`features/game-timer/notification`。
 * 通知文案在**创建通知时**取当前语言（频道名 / 分类按钮在初始化时注册）。
 */
export const zhTimer = {
  timer: {
    /** VN 详情页的计时按钮（start-game-button） */
    start: "开始游戏",
    pause: "暂停",
    resume: "继续",
    stop: "结束",
    busyElsewhere: "其他作品计时中",

    /** 浮层展开后的圆形操作按钮（game-timer-overlay） */
    pauseTimer: "暂停计时",
    resumeTimer: "继续计时",
    stopTimer: "结束计时",

    /** 浮层圆形的读屏文案与提示 */
    a11y: "游戏计时 %{time}",
    a11yPaused: "游戏计时 %{time}，已暂停",
    expandHint: "点按展开暂停与结束，拖动可移动位置",

    /** 系统通知（notification） */
    channel: "游戏计时",
    notificationTitle: "游戏计时",
    notificationPaused: "%{time} · 已暂停",
  },
} as const;
