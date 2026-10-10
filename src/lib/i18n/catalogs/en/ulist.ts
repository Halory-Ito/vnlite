import type { CatalogOf } from "../catalog-types";

import type { zhUlist } from "../zh/ulist";

export const enUlist: CatalogOf<typeof zhUlist> = {
  ulist: {
    /* List tab */
    loadingAccount: "Loading account…",
    guestTitle: "Sign in to use your list",
    goLogin: "Sign in",
    loadingList: "Fetching your list from VNDB…",
    emptyTitle: "Your list is empty",
    emptyDescription: "Pull to refresh from VNDB, or add VNs to your list on vndb.org",
    emptyLabelTitle: "No VNs with this label",
    emptyLabelDescription: "Pull to refresh to fetch more from VNDB",
    loadMore: "Load more",
    loadingMore: "Loading more…",

    /* Entry edit screen */
    invalidIdTitle: "Invalid VN ID",
    invalidIdDescription: "This list entry link is invalid; go back to your list and open it again",
    loadingEntry: "Fetching the list entry from VNDB…",
    coverLabel: "%{title} cover",
    openVnDetails: "View details for %{title}",
    editEntryLabel: "Edit list entry (status / vote / labels)",
    startedDate: "Started",
    finishedDate: "Finished",
    notesLabel: "Notes (only visible to you)",
    notesPlaceholder: "Write something…",
    notes: "Notes",
    saveChanges: "Save changes",
    processing: "Working…",
    savedToVndb: "Saved to VNDB",
    saveFailed: "Save failed, please try again",
    dateFormatError: "Format must be YYYY-MM-DD",
    dateRangeError: "Finished date is earlier than the started date",

    /* Add / remove */
    notInListTitle: "Not in your list yet",
    notInListDescription:
      "Once added, you can vote, label it and track your progress; changes are written straight to VNDB",
    adding: "Adding…",
    addToList: "Add to list",
    added: "Added to list",
    addFailed: "Failed to add, please try again",
    remove: "Remove",
    removeFromList: "Remove from list",
    removeConfirm: "Remove",
    confirmRemove: "Confirm removal",
    removeConfirmDescription:
      "This also deletes all release ownership records for this VN. It cannot be undone.",
    removeHint:
      "Removing also deletes all release ownership records for this VN. This cannot be undone",
    removed: "Removed from list",
    removeFailed: "Remove failed, please try again",

    /* Labels */
    statusLabel: "Status (tap again to unselect)",
    customLabels: "Custom labels",
    moreLabels: "+%{count} labels",

    /* Vote */
    vote: "Vote",
    voteRange: "Vote (10–100)",
    notVoted: "Not voted",
    clearVote: "Clear vote",

    /* Date fields */
    today: "Today",
    setToday: "Set %{label} to today",
    clearField: "Clear %{label}",

    /* Release collection status */
    checking: "Checking…",
    updateFailed: "Update failed, please try again",
  },
};
