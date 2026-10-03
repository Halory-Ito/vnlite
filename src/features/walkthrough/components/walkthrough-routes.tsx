/**
 * 线路列表（攻略页签的主体骨架）。
 *
 * 数据本身是三层：作品 → 线路（route）→ 结局（ending）→ 步骤（step）。
 * UI 上省略作品那层（页面已经是它的详情页），线路用 HeroUI 的 `Accordion`：
 *
 * ## 为什么线路要再折一层
 *
 * 最多 12 条线路（v29884），每条下面挂着若干结局。全部铺开的话首屏就是一长串
 * 结局名，真正的内容（步骤）要滚很久才够得着，而且**每条线路的结局卡都被挂载了**。
 *
 * 用 `Accordion` 还顺带拿到一个关键性质：`Accordion.Content` 在收起时
 * 返回 `null`（不是 `display:none`），所以**收起的线路完全不渲染结局**。
 * 这是手写折叠做不到的 —— 手写只能自己判断要不要渲染子组件。
 *
 * ## 为什么是 `multiple` 而不是默认的 `single`
 *
 * 攻略的常见用法是**对照着看**：一边开着 A 线确认某选项，一边翻 B 线的分支。
 * `single` 会强制收起另一条，来回对照要反复点开。
 *
 * ## 默认全收起
 *
 * 与「结局默认收起」同一个理由：先给全局概览（有哪些线路、多少结局），
 * 再逐层深入。
 */

import { Accordion, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Muted, Paragraph } from "@/components/typo";

import type { Walkthrough, WalkthroughRoute } from "../types";
import type { WalkthroughMarkApi } from "../use-marks";
import { EndingCard } from "./walkthrough-ending-card";

export interface WalkthroughRoutesProps {
  walkthrough: Walkthrough;
  /** 剧透保护是否生效 */
  shield: boolean;
  marks: WalkthroughMarkApi;
}

export function WalkthroughRoutes({ walkthrough, shield, marks }: WalkthroughRoutesProps) {
  return (
    <View className="px-4">
      {/*
       * `hideSeparator` 必须开：HeroUI 默认会在**每对子节点之间**插一条发丝线，
       * 而每条线路自带一圈底板（`Accordion.Item` 上的 rounded-lg bg-default-soft），
       * 中间再夹一条线会像渲染错了。
       * 而且 Root 是用 `Children.map` 把分隔线**穿插**进子节点之间的 ——
       * 不藏起来的话 `gap-2` 会在「卡片 / 分隔线 / 卡片」之间各留一次，间距翻倍。
       *
       * ⚠️ 样式只能挂在各自的子组件上：根组件的 `classNames` 只认
       * `container` / `separator` / `base` 三个槽位，没有 trigger / content。
       */}
      <Accordion selectionMode="multiple" hideSeparator className="gap-2">
        {walkthrough.routes.map((route) => (
          <RouteItem key={route.id} route={route} shield={shield} marks={marks} />
        ))}
      </Accordion>
      <View className="h-6" />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 单条线路                                                                    */
/* -------------------------------------------------------------------------- */

function RouteItem({
  route,
  shield,
  marks,
}: {
  route: WalkthroughRoute;
  shield: boolean;
  marks: WalkthroughMarkApi;
}): JSX.Element {
  // 图标只能吃具体色值，不能写 className，也不能写 `currentColor`。
  // 这里每条线路取一次 —— 是线路数（最多 12），不是步骤数，所以开销可忽略。
  const accent = useThemeColor("accent");

  return (
    <Accordion.Item value={route.id} className="rounded-lg bg-default-soft">
      <Accordion.Trigger
        // 默认 padding-block 是 spacing*4（16px），十几条线路排下来太松，压到 8px
        className="py-2"
        accessibilityLabel={`${route.name}，点按展开该线路的结局`}
      >
        {/* Trigger 是 space-between：左边内容自己撑开，右边留给 Indicator */}
        <View className="flex-1 flex-row items-center gap-2">
          <Icon name="route" size={14} color={accent} />
          <Paragraph className="flex-1 text-sm font-semibold" numberOfLines={2}>
            {route.name}
          </Paragraph>
        </View>
        {/* HeroUI 自带的旋转箭头，省掉自己画 chevronRight / chevronDown 切换 */}
        <Accordion.Indicator />
      </Accordion.Trigger>

      <Accordion.Content className="px-3 pb-3">
        {route.description ? (
          <Muted type="body-xs" className="pb-2 pl-6 leading-4">
            {route.description}
          </Muted>
        ) : null}

        {/*
         * 结局是**嵌套**的第二个 Accordion，不是并进外面那个 ——
         * 并进去两层的展开状态会混进同一个扁平集合，出现「结局开着但线路收起、
         * 重开线路时结局还开着」。嵌套后每层各管各的，而且线路收起时
         * 这一层压根不会被渲染（Content 返回 null），懒挂载照样成立。
         */}
        <Accordion selectionMode="multiple" hideSeparator className="gap-2">
          {route.endings.map((ending) => (
            <EndingCard key={ending.id} ending={ending} shield={shield} marks={marks} />
          ))}
        </Accordion>
      </Accordion.Content>
    </Accordion.Item>
  );
}
