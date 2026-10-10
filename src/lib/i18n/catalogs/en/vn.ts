import type { CatalogOf } from "../catalog-types";

import type { zhVn } from "../zh/vn";

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
    tabDiscussions: "Discussions",
    tabWalkthrough: "Walkthrough",
    tabRecords: "Play time",
    tabExtLinks: "Links",

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
