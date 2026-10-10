import type { CatalogOf } from "../catalog-types";

import type { zhSearch } from "../zh/search";

/** English catalog · search. 用词对齐 vndb.org（Visual novels / Staff / Producers…） */
export const enSearch: CatalogOf<typeof zhSearch> = {
  search: {
    scope: {
      vn: "VN",
      staff: "Staff",
      user: "User",
      producer: "Producer",
    },

    noun: {
      vn: "visual novels",
      staff: "staff",
      user: "users",
      producer: "producers",
    },

    loading: "Searching…",
    loadingMore: "Loading more…",
    lookingUp: "Looking up…",

    emptyTitle: "Nothing found",
    emptyDescription: "No %{noun} found for “%{keyword}”",
    userEmptyTitle: "User not found",
    vnEmptyTitle: "No visual novels found",

    resultsHeadline: "Search results for “%{keyword}”",

    userMissId: "No user with ID %{id}",
    userMissHint:
      "Search by the full username (e.g. Yorhel) or user ID (e.g. u2) — the user API does not support partial matches",
  },
};
