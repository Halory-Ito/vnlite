import type { CatalogOf } from "../catalog-types";

import type { zhMisc } from "../zh/misc";

/** English catalog · misc namespace（API error messages, clipboard hints）. */
export const enMisc: CatalogOf<typeof zhMisc> = {
  misc: {
    apiError: {
      badRequest: "VNDB rejected the request; check your filters",
      unauthorized: "Token is invalid or has expired, please log in again",
      notFound: "Endpoint does not exist or the entry has been deleted",
      rateLimited: "Too many requests; automatically queued, please wait",
      serverError: "VNDB server is temporarily unavailable",
      network: "Network connection failed, please check your connection",
      parse: "Failed to parse the response",
      unknown: "Something went wrong",
    },

    copy: {
      hint: "Long-press to copy",
      done: "Copied",
      failed: "Copy failed, please try again",
      message: "%{head}: %{preview}",
    },

    randomUnavailable: "Couldn't fetch a random visual novel, please try again later",
  },
};
