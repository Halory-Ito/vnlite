import type { QueryResponse } from "./types";

/** Empty HTTP bodies and JSON null are invalid list responses, not empty result sets. */
export function validateQueryResponse<T>(value: unknown): QueryResponse<T> {
  if (
    !value ||
    typeof value !== "object" ||
    !("results" in value) ||
    !Array.isArray(value.results) ||
    !("more" in value) ||
    typeof value.more !== "boolean"
  ) {
    throw new TypeError("Invalid query response: expected results array and more boolean");
  }
  return value as QueryResponse<T>;
}
