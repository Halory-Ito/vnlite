import type { CatalogOf } from "../catalog-types";

import type { zhCatalog } from "../zh/catalog";

export const enCatalog: CatalogOf<typeof zhCatalog> = {
  catalog: {
    characterFallback: "Character",
    producerFallback: "Producer",
    staffFallback: "Staff",
    tagFallback: "Tag",

    sex: "Sex",
    age: "Age",
    birthday: "Birthday",
    birthdayFormat: "%{month}/%{day}",
    birthdayMonth: "%{month}",
    bloodType: "Blood type",
    body: "Body",
    bust: "Bust %{cm} cm",
    traits: "Traits",
    description: "Description",

    tabOverview: "Info",
    tabWorks: "Visual novels",
    tabExtLinks: "Links",
    worksLoading: "Loading visual novels…",
    worksEmptyTitle: "No visual novels listed",
    worksEmptyProducer: "This producer has no visual novels on VNDB",
    worksEmptyStaff: "This staff member has no visual novels on VNDB",
    extlinksEmptyProducer: "This producer has no links on VNDB",
    extlinksEmptyStaff: "This staff member has no links on VNDB",
    producerNoDescription: "This producer has no description",
    staffNoDescription: "This staff member has no description",
    relatedVns: "Appears in",

    tagDescription: "Description",
    tagCount: "%{count} visual novels are tagged with this tag",
    tagWorksTitle: "Visual novels",
    tagDirectOnly: "Direct only",
    tagInherited: "Including parent tags",
    tagWorksEmpty: "No visual novels with this tag",

    extlinksEmptyTitle: "No links",
    extlinksEmptyDescription: "No links are listed on VNDB",
    extlinksCopied: "Link copied",
    extlinksOpen: "Open %{site}: %{name}",
    logoLabel: "%{name} logo",
    siteHomepage: "Official website",
    siteWikipediaJa: "Wikipedia (ja)",
    siteDengeki: "Dengeki",
  },
};
