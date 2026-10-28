/**
 * English · ranking module (year / tag / awards).
 */
import type { CatalogOf } from "@/lib/i18n/catalogs/catalog-types";
import type { zhRanking } from "@/lib/i18n/catalogs/zh/ranking";

export const enRanking: CatalogOf<typeof zhRanking> = {
  ranking: {
    title: "Rankings",
    modeYear: "Year",
    modeTag: "Tag",
    /** Awards tab is parked behind a "coming soon" placeholder for now */
    modeComing: "Coming soon",
    awardsComingSoon: "Awards in the works — stay tuned",

    pickYear: "Pick a year",
    pickTag: "Choose tags",
    pickTagCount: "Choose tags (%{count})",
    pickDept: "Department",

    /** Tag panel */
    tagSearchResults: "Search results",
    selectedTitle: "Selected",
    poolTitle: "Tag list",
    tagPoolEmpty: "No tags yet — search above to add one",

    loading: "Crunching the numbers…",
    emptyTitle: "Nothing to rank here",
    emptyDescription: "Try another year or tag",
    scoreMeta: "%{rating} · %{votes} votes",
    rowLabel: "No. %{rank}: %{title}",

    /** Two award families (awards-section) */
    awardsMoe: "Moe Game Award",
    awardsGetchu: "Bishōjo Game Award",
    awardsMoeNote: "Moe Game Award main prizes over the years (official site / Japanese Wikipedia)",
    awardsGetchuNote:
      "Getchu Bishōjo Game Award annual vote, 2010–2023 (service closed; archived copy)",

    /** Moe award levels */
    prizeGrand: "Grand Prize",
    prizeSemi: "Runner-up",
    prizeGold: "Gold Prize",
    prizeSilver: "Silver Prize",
    prizeBronze: "Bronze Prize",

    /** Getchu departments (official button order) */
    deptTotal: "Overall",
    deptScenario: "Scenario",
    deptSystem: "System",
    deptGraphic: "Graphics",
    deptMusic: "Music",
    deptMovie: "Movie",
    deptChara: "Character",
    deptEros: "Ero",
  },
};
