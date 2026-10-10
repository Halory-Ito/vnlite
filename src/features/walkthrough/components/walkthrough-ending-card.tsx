/**
 * 结局折叠行。
 *
 * 用 HeroUI 的 `Accordion`，**嵌套在线路那个 Accordion 里面**（不是合并成一个）——
 * 合并的话两层的展开状态会混进同一个扁平集合，出现「结局展开着但线路收起、
 * 重开线路时结局还开着」这种不一致。嵌套之后每层各管各的。
 *
 * 嵌套还顺带保住了懒挂载：线路收起时它的 `Content` 返回 null，
 * 连这一层 Accordion 都不会被渲染。
 *
 * ## 一行里有三个互不抢触的点击区
 *
 *   结局名 / 达成条件（点开内容）          [☑] [▾]
 *
 * - **内容区**：展开 / 收起。达成条件里的 flag 也是剧透，剧透保护开启时同样打码
 * - **☑**：标记「已达成」。走完一个结局就打一下，相当于存档记录
 * - **▾**：HeroUI 自带的旋转箭头（挂在 Item 下而不是 Trigger 里，
 *   这样点它不会连带触发展开逻辑）
 *
 * ⚠️ 内容区必须**独立于**右列两个按钮：剧透保护下点内容是「显示原文」，
 * 不能被达成勾抢走（否则想看原文却把结局标成已达成）。
 * 同理也不能做成「整行点击 = 达成」。
 */

import { Accordion, Checkbox, Chip, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { useTranslation } from "@/hooks/use-translation";

import { endingMeta } from "../select";
import type { WalkthroughEnding } from "../types";
import type { WalkthroughMarkApi } from "../use-marks";
import { SpoilerText } from "./spoiler-text";
import { WalkthroughSteps } from "./walkthrough-steps";

export interface EndingCardProps {
  ending: WalkthroughEnding;
  /** 剧透保护是否生效 */
  shield: boolean;
  marks: WalkthroughMarkApi;
}

export function EndingCard({ ending, shield, marks }: EndingCardProps): JSX.Element {
  const { t } = useTranslation();
  const success = useThemeColor("success");
  const meta = endingMeta(ending.type);
  const achieved = marks.isAchieved(ending.id);
  const stepCount = ending.steps?.length ?? 0;

  return (
    <Accordion.Item
      value={ending.id}
      className="rounded-lg bg-default-soft"
      // HeroUI 的 Checkbox 没有 color prop，达成的语义色由整行的 success 左边框承担
      style={achieved ? { borderLeftWidth: 3, borderLeftColor: success } : undefined}
    >
      <View className="flex-row items-center gap-2 px-3 py-2.5">
        {/*
         * ⚠️ `flex-1` 必须加在**这一层普通 View** 上，不能直接加给 Trigger。
         *
         * HeroUI 的 `Accordion.Trigger` 渲染成 `Header(View) > Pressable`，
         * 而 `className` 只落在**内层 Pressable** 上 —— 外层 Header 拿不到 className。
         * 本行的 flex 子节点是 Header，所以只给 Trigger 加 `flex-1` 是加错位置的：
         * Header 仍按内容宽度收缩，Trigger 也就在内层按**高度**伸缩（完全没用），
         * 于是文字后面紧跟着勾与箭头、右端空出一大片 ——
         * 表现就是「结局名 徽标 ☑ ⌄」后面拖一截空白。
         *
         * `flex-col` / `items-stretch` / `p-0` 仍然是必要的：Trigger 的底样式是
         * `flex-direction: row` + `align-items: center`（row 让「结局名 + 达成条件」并排，
         * center 让它们水平居中而不是撑满），内边距清零是因为外层这个 View 已经给了。
         */}
        <View className="flex-1">
          <Accordion.Trigger
            className="flex-col items-stretch gap-1 p-0"
            accessibilityLabel={t("walkthrough.expandEnding", { ending: ending.name })}
          >
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <SpoilerText
                text={ending.name}
                shield={shield}
                variant="plain"
                className="min-w-0"
                numberOfLines={1}
              />
              {/* 未知 type 查不到文案 → 不挂徽标，而不是把原始英文枚举显示给用户 */}
              {meta.label ? (
                <Chip size="sm" variant="soft" color={meta.tone} className="shrink-0">
                  <Chip.Label numberOfLines={1}>{meta.label}</Chip.Label>
                </Chip>
              ) : null}
            </View>

            {/* 达成条件是这份攻略最有价值的部分之一（flag / 前置周目） */}
            {ending.requirements ? (
              <View className="flex-row items-start gap-1.5">
                <SpoilerText
                  text={ending.requirements}
                  shield={shield}
                  className="flex-1 shrink-0 opacity-60"
                />
              </View>
            ) : null}
          </Accordion.Trigger>
        </View>

        {/* 右列：达成勾 + 展开箭头，各自在行的末尾。
            ⚠️ `Accordion.Indicator` 读的是 Item 的展开状态，但**不在 Trigger 里**——
            放进去点箭头会同时触发 Trigger 的展开逻辑。 */}
        <View className="flex-row shrink-0 items-center gap-1">
          <Checkbox
            isSelected={achieved}
            onSelectedChange={() => marks.toggleEnding(ending.id)}
            accessibilityLabel={
              achieved
                ? t("walkthrough.unmarkEnding", { ending: ending.name })
                : t("walkthrough.markEnding", { ending: ending.name })
            }
          />
          {stepCount > 0 ? <Accordion.Indicator /> : <View className="w-4" />}
        </View>
      </View>

      {/* 收起时 Content 返回 null —— 步骤完全不挂载。
          没有步骤的结局干脆不挂 Content（也就没有箭头）。 */}
      {stepCount > 0 ? (
        <Accordion.Content className="px-3 pb-3 pt-1">
          <View className="border-t border-border pt-3">
            <WalkthroughSteps steps={ending.steps ?? []} shield={shield} marks={marks} />
          </View>
        </Accordion.Content>
      ) : null}
    </Accordion.Item>
  );
}
