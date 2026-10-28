/**
 * English · calendar module (release calendar).
 */
import type { CatalogOf } from "@/lib/i18n/catalogs/catalog-types";
import type { zhCalendar } from "@/lib/i18n/catalogs/zh/calendar";

export const enCalendar: CatalogOf<typeof zhCalendar> = {
  calendar: {
    title: "Release calendar",
    monthTitle: "%{month}/{year}",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    jump: "Go to",
    jumpTitle: "Jump to a date",
    jumpDateLabel: "Date",
    jumpConfirm: "Go",
    loading: "Building the calendar…",
    unrated: "Not rated yet",
    weekdays: "S,M,T,W,T,F,S",
    dayLabel: "Day %{day}, show releases",
    dayEmpty: "Nothing released on this day",
  },
};
