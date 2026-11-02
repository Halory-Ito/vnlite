import type { TranslationKey } from "@/lib/i18n/translate";

export const HOME_SECTION_IDS = [
  "quote",
  "today",
  "annual",
  "heatmap",
  "random",
  "calendar",
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
const DEFAULT_VISIBLE_SECTIONS = new Set<HomeSectionId>(["quote", "today", "annual", "heatmap"]);
export const HOME_SECTION_LABELS: Record<HomeSectionId, TranslationKey> = {
  today: "home.todayPlay",
  annual: "home.yearGoal",
  heatmap: "home.playHeatmap",
  quote: "home.quoteTitle",
  random: "home.randomTitle",
  calendar: "home.calendar",
  discover: "home.discoverTitle",
  reviews: "home.feedReviews",
  upcoming: "home.feedUpcoming",
  released: "home.feedReleased",
};
export function normalizeHomeLayout(value: unknown): HomeSectionPreference[] {
  const result: HomeSectionPreference[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value))
    for (const entry of value) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !HOME_SECTION_IDS.includes(entry.id) ||
        seen.has(entry.id)
      )
        continue;
      seen.add(entry.id);
      result.push({ id: entry.id, visible: entry.visible !== false });
    }
  if (!seen.has("calendar")) {
    const discover = result.findIndex((entry) => entry.id === "discover");
    if (discover >= 0) {
      result.splice(discover, 0, { id: "calendar", visible: result[discover]!.visible });
      seen.add("calendar");
    }
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
    if (
      (id === "today" || id === "annual") &&
      previous?.length === 1 &&
      (previous[0] === "today" || previous[0] === "annual")
    )
      previous.push(id);
    else rows.push([id]);
  }
  return rows;
}
