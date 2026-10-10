import type { CatalogOf } from "../catalog-types";

import type { zhHistory } from "../zh/history";

export const enHistory: CatalogOf<typeof zhHistory> = {
  history: {
    /* Screen */
    title: "History",
    tabVn: "VNs",
    tabPeople: "People",
    tabUser: "Users",
    tabProducer: "Producers",
    loading: "Loading history…",
    emptyTitle: "No history yet",
    emptyDescription: "VNs, staff, users and producers you view will be recorded here",
    loadingMore: "Loading more…",
    longPressRemove: "Long-press to delete",
    timeRange: "Time range",
    timeRangeFiltered: "Time range, filtered",
    clearTitle: "Clear history",
    clearDescription: "Deletes all records in the selected categories. This cannot be undone.",

    /* Date filter panel */
    quickSelect: "Quick select",
    presetToday: "Today",
    presetWeek: "Last 7 days",
    presetMonth: "Last 30 days",
    startDate: "Start date",
    endDate: "End date",
    today: "Today",
    setToday: "Set %{label} to today",
    clearField: "Clear %{label}",
    dateIncomplete: "Enter all 8 digits",
    dateInvalid: "Invalid date",
    dateRangeOrder: "End date is before the start date",
  },
};
