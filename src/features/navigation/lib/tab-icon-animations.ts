import type { AnimationObject } from "lottie-react-native";

import home from "@/assets/animations/useanimations/home.json";
import explore from "@/assets/animations/useanimations/explore.json";
import search from "@/assets/animations/useanimations/searchToX.json";
import bookmark from "@/assets/animations/useanimations/bookmark.json";
import user from "@/assets/animations/useanimations/user.json";
import license from "@/assets/animations/useanimations/license.json";

export type TabIconName = "house" | "compass" | "magnifier" | "bookmark" | "person";

function icon(source: AnimationObject, index: number, returnToStart = false) {
  const speed = returnToStart ? 3 : 1.5;
  return {
    index,
    start: source.ip,
    end: source.op - 1,
    returnToStart,
    duration: Math.round(
      ((source.op - source.ip) / source.fr / speed) * (returnToStart ? 2 : 1) * 1000
    ),
    // Name stripped layers once so native filters can recolor without reloading.
    source: {
      ...source,
      meta: { license },
      layers: source.layers.map((layer, position) => ({ ...layer, nm: `tab-icon-${position}` })),
    },
  };
}

export const TAB_ICON_ANIMATIONS = {
  house: icon(home, 0),
  compass: icon(explore, 1),
  magnifier: icon(search, 2, true),
  bookmark: icon(bookmark, 3),
  person: icon(user, 4),
} satisfies Record<TabIconName, ReturnType<typeof icon>>;
