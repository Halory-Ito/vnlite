import type { CatalogOf } from "../catalog-types";

import type { zhUser } from "../zh/user";

export const enUser: CatalogOf<typeof zhUser> = {
  user: {
    /* Profile screen */
    title: "User",
    loadingProfile: "Fetching profile…",
    notFoundTitle: "Couldn't load this user's profile",
    notFoundDescription: "The user doesn't exist, or VNDB changed its markup and parsing failed",
    statListVns: "List VNs",
    statVotes: "Votes",
    statPosts: "Posts",
    profileSection: "Profile",
    username: "Username",
    registered: "Registered",
    playtime: "Play time",
    playthroughs: " (%{count} playthroughs)",
    edits: "Edits",
    listStats: "List stats",
    listReleases: "%{count} releases",
    reviewsLabel: "Reviews",
    reviewCount: "%{count}",
    threadsLabel: "Threads",
    threadCount: "%{count}",
    traitsSection: "Self-tagged traits",
    voteDistribution: "Vote distribution",
    recentVotes: "Recent votes",
    viewAll: "View all",
    viewAllLabel: "View all votes",

    /* All votes screen */
    votesTitle: "%{name}'s votes",
    allVotes: "All votes",
    fetching: "Fetching…",
    loadedCount: "%{count} loaded",
    loadingVotes: "Fetching votes…",
    votesEmpty: "This user has no public votes",
    noMore: "No more results",

    /* Visible columns */
    columns: "Columns",
    columnsLabel: "Choose visible columns",
    columnsPanelTitle: "Visible columns",
    columnsGroup: "Information shown in the list",
    columnTitle: "Title",
    columnScore: "Vote",
    columnPlaytime: "Play time",
    columnSpeed: "Speed",
    columnVotedAt: "Voted",
    columnStarted: "Started",
    columnFinished: "Finished",
    fieldScore: "Vote",
    fieldPlaytime: "Time",
    fieldSpeed: "Speed",
    fieldVotedAt: "Voted",
    fieldStarted: "Started",
    fieldFinished: "Finished",
    openVn: "Open VN: %{title}",
  },
};
