import type { CatalogOf } from "../catalog-types";

import type { zhFavorite } from "../zh/favorite";

export const enFavorite: CatalogOf<typeof zhFavorite> = {
  favorite: {
    /* Screen */
    title: "Favorites",
    tabVn: "VNs",
    tabPeople: "People",
    tabUser: "Users",
    tabProducer: "Producers",
    loading: "Loading favorites…",
    emptyTitle: "No favorites yet",
    emptyDescription: "Tap the star on a VN, staff, user or producer page to add it to favorites",
    loadingMore: "Loading more…",
    longPressRemove: "Long-press to remove from favorites",
    clear: "Clear favorites",
    clearDescription: "Deletes all favorites in the selected categories. This cannot be undone.",

    /* Favorite button */
    favorite: "Favorite",
    favorited: "Favorited",
    addLabel: "Add to favorites",
    removeLabel: "Remove from favorites",
    addedToast: "Added to favorites",
    removedToast: "Removed from favorites",
  },
};
