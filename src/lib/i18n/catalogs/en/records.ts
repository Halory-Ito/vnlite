import type { CatalogOf } from "../catalog-types";

import type { zhRecords } from "../zh/records";

/** English catalog · records namespace（play records）. */
export const enRecords: CatalogOf<typeof zhRecords> = {
  records: {
    loading: "Loading play records…",
    emptyTitle: "No play records yet",
    emptyDescription: "Tap “Start playing” on the VN page; finished sessions are saved here",

    view: {
      chart: "Chart",
      list: "List",
    },

    chart: {
      total: "Total time",
      sessions: "Sessions",
      average: "Average",
      longest: "Longest",
      previousMonth: "Previous month",
      nextMonth: "Next month",
      monthSummary: "This month %{duration} · %{count} sessions",
      monthEmpty: "No play records this month",
    },

    list: {
      edit: "Edit",
      delete: "Delete",
      deleteTitle: "Delete record",
      deleteDescription: "This cannot be undone.",
    },

    edit: {
      title: "Edit record",
      start: "Start",
      end: "End",
      invalid: "Invalid time",
      datePlaceholder: "YYYY-MM-DD",
      timePlaceholder: "HH:mm",
      dateField: "%{label} date",
      timeField: "%{label} time",
    },

    error: {
      dateFormat: "Date must be in YYYY-MM-DD format",
      timeFormat: "Time must be in HH:mm format",
      range: "End time is earlier than start time",
    },

    duration: {
      seconds: "%{seconds} sec",
      minutes: "%{minutes} min",
      hours: "%{hours} h",
      hoursMinutes: "%{hours} h %{minutes} min",
    },

    yearMonth: "%{year}/%{month}",
  },
};
