import type { CatalogOf } from "../catalog-types";

import type { zhStats } from "../zh/stats";

export const enStats: CatalogOf<typeof zhStats> = {
  stats: {
    /* Statistics screen */
    title: "Statistics",
    collectionTitle: "List stats",
    loginHint: "Statistics read your own list. Paste a VNDB token under Me → Account first",
    goLogin: "Sign in",
    collectionLoading: "Loading your list…",
    collectionEmpty:
      "Your list is empty. Add a few VNs on VNDB and you'll see breakdowns by decade, label, type and producer here",
    total: "Total",
    finished: "Finished",
    averageVote: "My average",
    decades: "Release decade",
    labels: "List labels",
    gameTypes: "Game types",
    topDevelopers: "Top %{count} producers",
    typesLoading: "Loading game types…",
    typesFailed: "Failed to load game types: %{message}",
    typesEmpty: "None of the VNs in your list are tagged with ADV / NVL / RPG or similar",
    pieEmpty: "No data to chart",

    /* Play stats */
    playTitle: "Play stats",
    playLoading: "Loading play sessions…",
    playFailed: "Failed to load play sessions",
    playEmpty:
      "No play sessions yet. Tap “Start game” on a VN page; finished sessions will show up here",
    totalTime: "Play time",
    playCount: "Sessions",
    playedVns: "VNs played",
    playtimeRanking: "Play time ranking",
    typePlaytime: "Play time by type",
    playTypesEmpty: "None of the played VNs are tagged with ADV / NVL / RPG or similar",
    monthlyPlaytime: "Monthly play time",
    weeklyPlaytime: "Weekly play time",
    monthLabel: "%{month}",

    /* Database stats (empty search screen) */
    dbVn: "Visual novels",
    dbReleases: "Releases",
    dbCharacters: "Characters",
    dbStaff: "Staff",
    dbProducers: "Producers",
    dbTags: "Tags",
    dbTraits: "Traits",
    dbFailed: "Failed to load statistics, try again later",
    dbCount: "%{count}",
  },
};
