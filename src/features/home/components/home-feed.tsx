/**
 * 首页信息流的范围切换：最新评价 / 即将发售 / 最新上架。
 *
 * 三栏对应 vndb.org 首页的同名三栏，条数也一致（`FEED_COUNT` = 10），
 * 区别是本项目的「发售」两栏按**作品**（VN）而不是发行版 ——
 * 发行版没有封面、站内也没有发行版详情页。
 *
 * 用 `SegmentedControl` 而不是 HeroUI `Tabs`：它就在首页的一个区块里，
 * 不需要页签栏那套指示块 / 横向滚动，选中态也和应用其它地方（外观、内容设置）一致。
 *
 * ⚠️ **不要给内容加 `flex-1`**：外层首页就是一个竖向 ScrollView，
 * 内容按自身高度铺开、跟着页面一起滚。给 flex-1 会被压成 0 高。
 */

import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { SegmentedControl } from "@/components/segmented-control";
import { ReviewList } from "@/features/review/components/review-list";

import { FEED_COUNT, FEED_TAB_LABEL, FEED_TABS, type FeedTab } from "../feed-config";

import { JustReleasedCarousel, UpcomingCarousel } from "./releases-feed";

/** 分段控件的选项（`SCOPE_OPTIONS` 那种形状，抽在 feed-config 里纯逻辑可测） */
const OPTIONS = FEED_TABS.map((value) => ({ value, label: FEED_TAB_LABEL[value] }));

export function HomeFeed(): JSX.Element {
  // 默认落在「最新评价」：官网首页排第一的那栏，也是三栏里唯一天天有新鲜内容的
  const [tab, setTab] = useState<FeedTab>("reviews");

  return (
    <View className="mt-2 gap-1">
      <View className="px-4">
        <SegmentedControl options={OPTIONS} value={tab} onChange={setTab} />
      </View>

      {tab === "reviews" ? <ReviewList limit={FEED_COUNT} /> : null}
      {tab === "upcoming" ? <UpcomingCarousel /> : null}
      {tab === "released" ? <JustReleasedCarousel /> : null}
    </View>
  );
}
