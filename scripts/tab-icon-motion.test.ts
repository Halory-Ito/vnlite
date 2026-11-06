// @ts-expect-error Bun test types are supplied by the Bun runtime.
import { expect, test } from "bun:test";
import { TAB_ICON_ANIMATIONS } from "../src/features/navigation/lib/tab-icon-animations";
import {
  iconAnimationDuration,
  iconAnimationProgress,
} from "../src/features/navigation/lib/tab-icon-motion";

test("ordinary icons play forward on entry and backward on exit", () => {
  const enter = [0, 0.25, 0.5, 0.75, 1].map((p) => iconAnimationProgress(p, false));
  const exit = [1, 0.75, 0.5, 0.25, 0].map((p) => iconAnimationProgress(p, false));
  expect(enter).toEqual([0, 0.25, 0.5, 0.75, 1]);
  expect(exit).toEqual(enter.toReversed());
});

test("search stays recognizable at both endpoints and reverses its entire cycle", () => {
  expect(iconAnimationProgress(0, true)).toBe(0);
  expect(iconAnimationProgress(1, true)).toBe(0);
  expect(iconAnimationProgress(0.5, true)).toBe(1);
  for (const returnToStart of [true, false]) {
    const enter = [0, 0.25, 0.5, 0.75, 1].map((p) => iconAnimationProgress(p, returnToStart));
    const exit = [1, 0.75, 0.5, 0.25, 0].map((p) => iconAnimationProgress(p, returnToStart));
    expect(exit).toEqual(enter.toReversed());
  }
});

test("partial reversals use the remaining distance instead of replaying a full animation", () => {
  expect(iconAnimationDuration(0.3, 0, 600)).toBe(180);
  expect(iconAnimationDuration(0.3, 1, 600)).toBe(420);
  expect(iconAnimationDuration(0.8, 0, 600)).toBe(480);
  expect(iconAnimationDuration(0.8, 1, 600)).toBe(120);
});

test("settled and reduced-motion endpoints require no playback", () => {
  expect(iconAnimationDuration(0, 0, 600)).toBe(0);
  expect(iconAnimationDuration(1, 1, 600)).toBe(0);
  expect(iconAnimationProgress(-0.1, false)).toBe(0);
  expect(iconAnimationProgress(1.1, false)).toBe(1);
});

test("all bundled icons retain local, themed assets and bounded animation durations", () => {
  const animations = Object.values(TAB_ICON_ANIMATIONS);
  expect(animations.map((animation) => animation.index)).toEqual([0, 1, 2, 3, 4]);
  for (const { source, duration } of animations) {
    expect(source.assets).toEqual([]);
    expect(source.layers.every((layer) => typeof layer.nm === "string")).toBe(true);
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(800);
  }
});
