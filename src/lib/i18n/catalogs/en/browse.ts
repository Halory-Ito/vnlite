import type { CatalogOf } from "../catalog-types";

import type { zhBrowse } from "../zh/browse";

/** English catalog · browse. 用词对齐 vndb.org（Popularity / Rating / Release date / Platforms…） */
export const enBrowse: CatalogOf<typeof zhBrowse> = {
  browse: {
    toolbar: {
      sort: "Sort",
      sortLabel: "Sort settings",
      sortLabelCustomized: "Sort settings, customized",
      display: "Display",
      displayLabel: "Card display settings",
      displayLabelCustomized: "Card display settings, customized",
      filter: "Filter",
      filterWithCount: "Filter · %{count}",
      filterLabel: "Filter",
      filterLabelWithCount: "Filter, %{count} selected",
      emptyFilteredTitle: "No visual novels match your filters",
      emptyFilteredDescription: "Try loosening the filters",
      emptyTitle: "The list is empty",
    },

    group: {
      collapse: "Show less",
      more: "%{count} more",
      hiddenSelected: "Some selected options are hidden; expand to see them",
    },

    filter: {
      title: "Filter",
      rating: "Minimum rating",
      votecount: "Minimum vote count",
      votecountOption: "≥%{min} votes",
      olang: "Original language",
      platform: "Platforms",
      length: "Length",
      devstatus: "Development status",
      released: "Released",
      releasedOption: "%{year} and later",
      content: "Content completeness",
      hasDescription: "Has description",
      hasScreenshot: "Has screenshots",
      none: "No filters set",
      selected: "%{count} selected",
      selectedHits: "%{count} selected · %{hits} matches",
      clearAll: "Clear all filters",
    },

    summary: {
      rating: "Rating ≥ %{min}",
      olang: "Original language: %{lang}",
      lang: "Language: %{lang}",
      lengthFallback: "%{hours} h",
      releasedRange: "%{from} – %{to}",
      releasedNow: "Now",
      votecount: "Vote count ≥ %{min}",
      remove: "Remove filter: %{label}",
    },

    sort: {
      title: "Sort",
      field: "Sort by",
      direction: "Direction",
      desc: "Descending",
      asc: "Ascending",
      reset: "Reset",
      resetLabel: "Reset to default sorting",
      option: {
        votecount: "Popularity",
        rating: "Rating",
        released: "Release date",
        id: "ID order",
      },
    },

    display: {
      title: "Card display",
      showAll: "Show all",
      groupLabel: "Information shown on list cards",
      field: {
        rating: "Rating",
        released: "Released",
        olang: "Original language",
        length: "Length",
        platforms: "Platforms",
        devstatus: "Development status",
      },
    },
  },
};
