// @ts-expect-error Bun test types are supplied by the Bun runtime.
import { test, expect, mock, afterEach } from "bun:test";

const platform = { OS: "android" };
const opened: string[] = [];
const intents: { action: string; params: unknown }[] = [];
let unavailable = false;
mock.module("react-native", () => ({ Platform: platform }));
mock.module("expo-linking", () => ({
  openURL: async (url: string) => {
    opened.push(url);
  },
}));
mock.module("expo-intent-launcher", () => ({
  startActivityAsync: async (action: string, params: unknown) => {
    if (unavailable) throw Error("not installed");
    intents.push({ action, params });
  },
}));
const { openQuarkAuthorization } =
  await import("../src/features/sync/lib/providers/quark/authorization-link");
afterEach(() => {
  platform.OS = "android";
  opened.length = 0;
  intents.length = 0;
  unavailable = false;
});

test("Android directs authorization to the main Quark app", async () => {
  const url = "https://su.quark.cn/4_eMHBJ?token=test-token";
  await openQuarkAuthorization(url);
  expect(intents).toEqual([
    {
      action: "android.intent.action.VIEW",
      params: {
        data: url,
        packageName: "com.quark.browser",
        className: "com.ucpro.MainActivity",
      },
    },
  ]);
  expect(opened).toEqual([]);
});
test("missing Quark reports failure so the existing QR code remains usable", async () => {
  unavailable = true;
  await expect(openQuarkAuthorization("https://su.quark.cn/4_eMHBJ?token=test")).rejects.toThrow();
  expect(opened).toEqual([]);
});
test("other platforms use the existing system link route", async () => {
  platform.OS = "ios";
  const url = "https://su.quark.cn/4_eMHBJ?token=test";
  await openQuarkAuthorization(url);
  expect(opened).toEqual([url]);
  expect(intents).toEqual([]);
});
