import { AppState, Linking, Platform } from "react-native";

export const releaseReminderKey = (id: string, date: string) => `release-reminder:${id}:${date}`;

async function waitForForeground() {
  if (AppState.currentState === "active") return;
  await new Promise<void>((resolve) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      subscription.remove();
      resolve();
    });
  });
}

export async function openReleaseReminder(id: string, date: string, title: string) {
  // Keep native module loading synchronous for Metro.
  const Calendar: typeof import("expo-calendar/legacy") = require("expo-calendar/legacy");
  const startDate = new Date(`${date}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  await Calendar.createEventInCalendarAsync(
    {
      title,
      startDate,
      endDate,
      allDay: true,
      notes: `https://vndb.org/${id}`,
      alarms: [{ relativeOffset: -15 * 60 }],
    },
    { startNewActivityTask: false }
  );
  await waitForForeground();
}

export async function openReleaseCalendar(date: string) {
  const startDate = new Date(`${date}T00:00:00`);
  if (Platform.OS === "android") {
    const IntentLauncher: typeof import("expo-intent-launcher") = require("expo-intent-launcher");
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: `content://com.android.calendar/time/${startDate.getTime()}`,
    });
    await waitForForeground();
    return;
  }
  // Subscribe before opening the calendar so returning cannot race Linking's promise.
  let left = false;
  let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
  const returned = new Promise<void>((resolve) => {
    subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") left = true;
      else if (left) resolve();
    });
  });
  try {
    const seconds = (startDate.getTime() - Date.UTC(2001, 0, 1)) / 1000;
    await Linking.openURL(`calshow:${seconds}`);
    await returned;
  } finally {
    subscription?.remove();
  }
}
