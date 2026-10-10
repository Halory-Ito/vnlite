/**
 * 首页信息流的档位与条数（纯常量 / 纯函数，冒烟可测）。
 *
 * ## 条数对齐官网
 *
 * 官网首页那三栏（Latest Reviews / Upcoming Releases / Just Released）
 * **各 10 条**（实测 2026-10-01）。Master 要求「默认展示的数量和官网首页一致」，
 * 所以这里写死 10 —— 不是随手取的整数。
 *
 * 官网的「评价」是**用户评价**（Kana 没有 reviews 端点，只能抓网站），
 * 「发售」两栏在官网是**发行版**，但发行版没有封面、站内也没有发行版详情页，
 * 所以本项目按**作品**（VN）来 —— 有封面、能跳进站内作品详情。
 */

import type { TranslationKey } from "@/lib/i18n/translate";

/** 三个页签，顺序即页签从左到右的顺序 */
export const FEED_TABS = ["reviews", "upcoming", "released"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

/** 页签文案的翻译键（不存文案：语言可切换） */
export const FEED_TAB_LABEL_KEY: Record<FeedTab, TranslationKey> = {
  reviews: "home.feedReviews",
  upcoming: "home.feedUpcoming",
  released: "home.feedReleased",
};

/** 与官网首页一致的条数（三栏都是 10） */
export const FEED_COUNT = 10;
