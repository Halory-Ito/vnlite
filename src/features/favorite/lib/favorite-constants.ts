/**
 * 收藏的展示档位与路由映射。
 *
 * 四个档位对应需求里的「作品 / 人员 / 用户 / 厂商」；
 * 「人员」聚合**角色 + 制作人员**两种存储类型（与浏览历史同一套约定）。
 */

import type { SegmentedOption } from "@/components/segmented-control";
import type { FavoriteType } from "@/lib/db/dao/favorite";
import type { TranslationKey } from "@/lib/i18n/translate";

/** 展示档位 */
export type FavoriteTab = "vn" | "people" | "user" | "producer";

/** 档位 → 存储类型集合 */
export const FAVORITE_TAB_TYPES: Record<FavoriteTab, FavoriteType[]> = {
  vn: ["vn"],
  people: ["character", "staff"],
  user: ["user"],
  producer: ["producer"],
};

/** 分段控件的选项（顺序即展示顺序；**存翻译键**，渲染时用 `favoriteTabOptions`） */
export const FAVORITE_TAB_OPTIONS: readonly { value: FavoriteTab; labelKey: TranslationKey }[] = [
  { value: "vn", labelKey: "favorite.tabVn" },
  { value: "people", labelKey: "favorite.tabPeople" },
  { value: "user", labelKey: "favorite.tabUser" },
  { value: "producer", labelKey: "favorite.tabProducer" },
];

/** 渲染期把档位翻成带文案的选项（分段控件与清空弹窗共用） */
export function favoriteTabOptions(
  t: (key: TranslationKey) => string
): SegmentedOption<FavoriteTab>[] {
  return FAVORITE_TAB_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));
}

/** 存储类型 → 详情页路由（`as const` 让 expo-router 的类型推断能通过） */
export const FAVORITE_TYPE_ROUTE = {
  vn: "/vn/[id]",
  character: "/character/[id]",
  staff: "/staff/[id]",
  producer: "/producer/[id]",
  user: "/user/[id]",
} as const;
