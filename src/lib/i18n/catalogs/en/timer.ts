import type { CatalogOf } from "../catalog-types";

import type { zhTimer } from "../zh/timer";

/** English catalog · timer namespace. */
export const enTimer: CatalogOf<typeof zhTimer> = {
  timer: {
    start: "Start playing",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
    busyElsewhere: "Timer running for another VN",

    pauseTimer: "Pause timer",
    resumeTimer: "Resume timer",
    stopTimer: "Stop timer",

    a11y: "Game timer %{time}",
    a11yPaused: "Game timer %{time}, paused",
    expandHint: "Tap to expand pause and stop; drag to move",

    channel: "Game timer",
    notificationTitle: "Game timer",
    notificationPaused: "%{time} · Paused",
  },
};
