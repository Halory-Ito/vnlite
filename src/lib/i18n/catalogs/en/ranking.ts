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
    modeAwards: "Awards",

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

    /** Moe award levels */
    prizeGrand: "Grand Prize",
    prizeSemi: "Runner-up",
    prizeGold: "Gold Prize",
    prizeSilver: "Silver Prize",
    prizeBronze: "Bronze Prize",

    /** Getchu departments */
    deptTotal: "Overall",
    deptScenario: "Scenario",
    deptSystem: "System",
    deptGraphic: "Graphics",
    deptMusic: "Music",
    deptMovie: "Movie",
    deptChara: "Character",
    deptEros: "Ero",
    deptNaming: "Title",
    deptVoice: "Voice",
    deptTheme: "Theme song",
    deptVocal: "Vocal",
    deptBgm: "BGM",
  },
};
