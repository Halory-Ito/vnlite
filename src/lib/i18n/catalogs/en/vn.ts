import type { CatalogOf } from "@/lib/i18n/catalogs/catalog-types";

import type { zhVn } from "@/lib/i18n/catalogs/zh/vn";

export const enVn: CatalogOf<typeof zhVn> = {
  vn: {
    loading: "Loading visual novel…",
    notFoundTitle: "Visual novel not found",
    notFoundDescription: "It may have been deleted from VNDB",
    statVotes: "Votes",
    statRating: "Rating",
    statLength: "Play time",

    tabInfo: "Info",
    tabCharacters: "Characters",
    tabStaff: "Staff",
    tabReleases: "Releases",
    tabScreenshots: "Screenshots",
    tabRelations: "Relations",
    tabQuotes: "Quotes",
    tabReviews: "Reviews",
    tabSimilar: "Similar",
    tabDiscussions: "Discussions",
    tabWalkthrough: "Walkthrough",
    tabRecords: "Play time",
    tabExtLinks: "Links",

    similarLoading: "Looking for similar novels…",
    similarEmptyTitle: "No similar novels found",
    similarEmptyDescription: "No other novel matches this tag combination — try another title",
    similarNoTags: "This novel has too few content tags to compute similarities",

    description: "Description",
    noDescription: "No description available.",
    tags: "Tags",

    charactersLoading: "Loading characters…",
    charactersEmpty: "No characters are listed for this visual novel.",

    staffEmpty: "No staff listed",
    cast: "Cast",

    releasesLoading: "Loading releases…",
    releasesEmpty: "No releases listed",

    screenshotsEmptyTitle: "No screenshots",
    screenshotsEmptyDescription: "This visual novel has no screenshots",
    screenshotHint: "Screenshot; tap to open fullscreen",
    screenshotLabel: "Screenshot %{index}",

    relationsEmptyTitle: "No relations",
    relationsEmptyDescription: "No relations are listed on VNDB",
    official: "Official",
    unofficial: "Unofficial",

    quotesLoading: "Loading quotes…",
    quotesEmpty: "No quotes are listed for this visual novel.",

    listEmpty: "No visual novels found",
    totalCount: "%{count} visual novels",
  },
};
