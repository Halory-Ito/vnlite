import type { TranslationKey } from "@/lib/i18n/translate";

export const HOME_SECTION_IDS = [
  "quote",
  "playStats",
  "heatmap",
  "calendar",
  "random",
  "discover",
  "reviews",
  "upcoming",
  "released",
] as const;
export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];
export interface HomeSectionPreference {
  id: HomeSectionId;
  visible: boolean;
}
const DEFAULT_VISIBLE_SECTIONS = new Set<HomeSectionId>([
  "quote",
  "playStats",
  "heatmap",
  "calendar",
]);
export const HOME_SECTION_LABELS: Record<HomeSectionId, TranslationKey> = {
  playStats: "home.playStats",
  heatmap: "home.playHeatmap",
  calendar: "home.releaseCalendar",
  quote: "home.quoteTitle",
  random: "home.randomTitle",
  discover: "home.discoverTitle",
  reviews: "home.feedReviews",
  upcoming: "home.feedUpcoming",
  released: "home.feedReleased",
};
export function normalizeHomeLayout(value: unknown): HomeSectionPreference[] {
  const result: HomeSectionPreference[] = [];
  const seen = new Set<string>();
  const legacyStats = new Set(["today", "annual", "totalDuration", "totalFinished"]);
  const hasCurrentStats = Array.isArray(value) && value.some((entry) => entry?.id === "playStats");
  if (Array.isArray(value))
    for (const entry of value) {
      if (
        !entry ||
        typeof entry !== "object" ||
        (!HOME_SECTION_IDS.includes(entry.id) && !legacyStats.has(entry.id)) ||
        seen.has(entry.id)
      )
        continue;
      if (legacyStats.has(entry.id)) {
        if (!hasCurrentStats && !seen.has("playStats")) {
          seen.add("playStats");
          result.push({ id: "playStats", visible: entry.visible !== false });
        }
        continue;
      }
      seen.add(entry.id);
      result.push({ id: entry.id, visible: entry.visible !== false });
    }
  for (const id of HOME_SECTION_IDS)
    if (!seen.has(id)) result.push({ id, visible: DEFAULT_VISIBLE_SECTIONS.has(id) });
  return result;
}
export function moveHomeSection(
  layout: readonly HomeSectionPreference[],
  id: HomeSectionId,
  offset: number
) {
  const index = layout.findIndex((item) => item.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= layout.length) return [...layout];
  const result = [...layout];
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
}
export function homeSectionRows(layout: readonly HomeSectionPreference[]): HomeSectionId[][] {
  const rows: HomeSectionId[][] = [];
  for (const { id } of layout.filter((item) => item.visible)) {
    const previous = rows.at(-1);
    if (id === "playStats" && previous?.length === 1 && previous[0] === "playStats")
      previous.push(id);
    else rows.push([id]);
  }
  return rows;
}
