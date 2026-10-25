/**
 * English · profile module (custom avatar).
 *
 * 接入点：`features/profile/*`（"Me" header avatar, account screen）。
 */
import type { CatalogOf } from "../catalog-types";
import { zhProfile } from "../zh/profile";

export const enProfile: CatalogOf<typeof zhProfile> = {
  profile: {
    changeAvatar: "Change avatar",
    removeAvatar: "Remove avatar",
    avatarSaved: "Avatar updated",
    avatarRemoved: "Avatar removed",
    avatarFailed: "Could not read that image, try another one",
  },
};
