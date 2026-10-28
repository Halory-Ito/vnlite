import type { CatalogOf } from "@/lib/i18n/catalogs/catalog-types";

import type { zhStats } from "@/lib/i18n/catalogs/zh/stats";

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

    /* List analysis page (/stats/list) */
    listAnalysis: "List analysis",
    laTitle: "List analysis",
    laRate: "Completion",
    laBacklog: "%{count} in backlog · about %{hours} h to go",
    laBacklogHint: "%{known} of %{total} have a known length; the rest are estimated as medium",
    laMyVote: "My average",
    laCommunityVote: "Community",
    laVoteDelta: "Difference",
    laStatus: "By status",
    laVotes: "Score distribution",
    laScore: "%{score} pts",
    laLoginTitle: "Sign in to see your list analysis",
    laLoginDescription: "Your list lives on VNDB, so signing in is required",
    laEmptyDescription: "Add a few VNs to your VNDB list first",

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
