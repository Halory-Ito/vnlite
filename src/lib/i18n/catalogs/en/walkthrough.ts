import type { CatalogOf } from "../catalog-types";

import type { zhWalkthrough } from "../zh/walkthrough";

/** English catalog · walkthrough namespace. */
export const enWalkthrough: CatalogOf<typeof zhWalkthrough> = {
  walkthrough: {
    loadingIndex: "Loading walkthrough index…",
    loading: "Loading walkthrough…",
    emptyTitle: "No walkthrough",
    emptyDescription:
      "Walkthroughs are community-maintained with limited coverage; this VN is not covered yet",
    noContent: "This walkthrough currently has no usable content",

    ending: {
      true: "True ending",
      good: "Good ending",
      normal: "Normal ending",
      bad: "Bad ending",
    },

    step: {
      save: "Save",
      load: "Load",
      note: "Note",
    },

    level: {
      detailed: "Detailed guide",
      brief: "Brief guide",
    },

    starred: "Starred %{count}",

    markStep: "Mark as done: %{step}",
    unmarkStep: "Unmark as done: %{step}",
    markEnding: "Mark as achieved: %{ending}",
    unmarkEnding: "Unmark as achieved: %{ending}",
    expandRoute: "%{route}, tap to show its endings",
    expandEnding: "%{ending}, tap to expand steps",
    reveal: "Tap to reveal",
    showMore: "Show more (%{count} steps left)",
    showMoreLabel: "Show more steps, %{count} remaining",
  },
};
