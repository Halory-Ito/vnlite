// @ts-expect-error Bun test types are supplied by the Bun runtime.
import { expect, test } from "bun:test";
import { validateQueryResponse } from "../src/lib/api/query-response";

test("rejects empty and malformed list responses instead of caching successful null data", () => {
  for (const value of [
    null,
    undefined,
    "",
    {},
    { results: null, more: false },
    { results: [], more: null },
    { results: [] },
  ]) {
    expect(() => validateQueryResponse(value)).toThrow(TypeError);
  }
});

test("accepts a genuinely empty day", () => {
  const response = { results: [], more: false };
  expect(validateQueryResponse(response)).toBe(response);
});

test("preserves results, pagination and count", () => {
  const response = { results: [{ id: "v1" }], more: true, count: 6 };
  expect(validateQueryResponse(response)).toBe(response);
});
