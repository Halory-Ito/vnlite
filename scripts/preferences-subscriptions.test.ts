// @ts-expect-error Bun test types are supplied by the Bun runtime.
import { afterAll, beforeEach, expect, test } from "bun:test";
import { getStore, registerStore } from "../src/lib/storage/key-value";
import {
  getPreference,
  patchPreferences,
  resetPreferences,
  setPreference,
  subscribePreference,
  subscribePreferences,
} from "../src/lib/storage/preferences";

const originalStore = getStore();
const saved = new Map<string, string>();
registerStore({
  get: async <T>(key: string) => JSON.parse(saved.get(key) ?? "null") as T | null,
  set: async (key, value) => {
    saved.set(key, JSON.stringify(value));
  },
  remove: async (key) => {
    saved.delete(key);
  },
  getOr: async <T>(key: string, fallback: T) =>
    saved.has(key) ? (JSON.parse(saved.get(key)!) as T) : fallback,
  clear: async () => {
    saved.clear();
  },
  keys: async () => [...saved.keys()],
});
beforeEach(async () => {
  await resetPreferences();
});
afterAll(() => registerStore(originalStore));

test("theme changes do not notify language, cover or title subscribers", async () => {
  let unrelated = 0;
  let themes = 0;
  const fields = [
    "language",
    "nsfwMode",
    "imageRadius",
    "showVnOriginalTitle",
    "cardFields",
    "homeLayout",
  ] as const;
  const dispose = fields.map((key) =>
    subscribePreference(key, () => {
      unrelated++;
    })
  );
  dispose.push(
    subscribePreference("themeId", () => {
      themes++;
    })
  );
  try {
    for (const id of ["fate", "saya", "air"]) await setPreference("themeId", id);
    expect(themes).toBe(3);
    expect(unrelated).toBe(0);
  } finally {
    dispose.forEach((unsubscribe) => unsubscribe());
  }
});

test("field subscribers receive current values and can unsubscribe", async () => {
  const seen: number[] = [];
  const unsubscribe = subscribePreference("imageRadius", () => {
    seen.push(getPreference("imageRadius"));
  });
  try {
    patchPreferences({ imageRadius: 12 });
    await setPreference("imageRadius", 16);
    expect(seen).toEqual([12, 16]);
    unsubscribe();
    patchPreferences({ imageRadius: 20 });
    expect(seen).toEqual([12, 16]);
  } finally {
    unsubscribe();
  }
});

test("unchanged selections do not publish another preference snapshot", async () => {
  let notifications = 0;
  const unsubscribe = subscribePreferences(() => {
    notifications++;
  });
  try {
    await setPreference("themeId", getPreference("themeId"));
    patchPreferences({ themeId: getPreference("themeId") });
    expect(notifications).toBe(0);
  } finally {
    unsubscribe();
  }
});

test("slider commit persists live preview even when the value is unchanged", async () => {
  patchPreferences({ cardOpacity: 0.43 });
  await setPreference("cardOpacity", 0.43);
  const persisted = JSON.parse(saved.get("vnlite.preferences")!);
  expect(persisted.cardOpacity).toBe(0.43);
});
