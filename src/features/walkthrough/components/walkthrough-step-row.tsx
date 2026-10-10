/**
 * 步骤行（带标记）。
 *
 * 一行里有两个互不抢触的点击目标，各自有明确的视觉归属：
 *
 *   `[☑]  存档  SAVE 1
 *          初期`
 *
 * - **☑**：标记「已走过」。攻略是一份待办清单，走过的打勾才有进度感
 * - **内容**：剧透保护开启时这里是打码区，点开显示原文
 *
 * ⚠️ 这两个必须各占独立点击区。如果做成「整行点一下 = 已走过」，
 * 剧透保护就会失效 —— 点内容想看原文，结果把步骤标成走过了。
 *
 * ⚠️ **不打序号**：攻略是照着走的流程，不是要按编号查阅的清单，
 * 编号占掉一列宽度却不带来任何信息 —— 「走到哪」由复选框与进度汇总负责表达。
 *
 * ## 为什么这个组件必须 `memo` + 为什么它里面不能有任何 `useThemeColor`
 *
 * 单个结局最多 500+ 步，一次打标记会让**整段所有行**重渲染。
 * `useThemeColor` → uniwind 的 `useCSSVariable` 每次渲染都要：
 * 查一次变量表 + 新建一个 `Map` 与两个闭包 + 在全局 `Set` 里退订再订阅
 * （它内部的 `subscribe` 没被 memo，effect 依赖每次渲染都变）。
 * 也就是说**一行一次 `useThemeColor` = 一行一次订阅抖动**。
 *
 * 所以这里一个主题色都不取 —— 复选框由 HeroUI 自己上色，
 * 文字颜色全走 `className`。⚠️ 别为了加图标 / 星标之类的就把 `useThemeColor`
 * 挂回这一行：几百行的列表里，那点装饰换来的重渲染代价太大
 * （配色要用就提到上层取一次，再当普通 prop 传下来）。
 */

import { Checkbox } from "heroui-native";
import type { JSX } from "react";
import { memo } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import { stepMeta } from "../select";
import type { WalkthroughStep } from "../types";
import { SpoilerText } from "./spoiler-text";

export interface WalkthroughStepRowProps {
  step: WalkthroughStep;
  /** 剧透保护是否生效 */
  shield: boolean;
  done: boolean;
  /** 稳定的回调引用 —— 不稳定的话 `memo` 直接失效 */
  onToggle: (stepId: string, field: "done" | "starred") => void;
}

/** 已走过的步骤整体压暗 —— 一眼看出走到哪了，不用逐行读勾 */
const DONE_FADE = "opacity-45";

function WalkthroughStepRowBase({
  step,
  shield,
  done,
  onToggle,
}: WalkthroughStepRowProps): JSX.Element {
  const { t } = useTranslation();
  // 唯一的计算：save / load 有小标签，choice 没有（满屏都是字就没法扫了）
  const labelKey = stepMeta(step.type).labelKey;

  return (
    <View className={`flex-row items-start gap-2.5 ${done ? DONE_FADE : ""}`}>
      {/*
       * HeroUI 的 Checkbox 受控用法。它已经自己带 `role="checkbox"` /
       * `accessibilityState` / `hitSlop` / 按压缩放动画 / 勾号淡入 / 主题配色，
       * 所以这里**只补 accessibilityLabel**（读屏时只念「复选框」没意义，
       * 必须说明是给哪条内容勾的），其余一概不重复传。
       */}
      <Checkbox
        isSelected={done}
        onSelectedChange={() => onToggle(step.id, "done")}
        accessibilityLabel={
          done
            ? t("walkthrough.unmarkStep", { step: step.content })
            : t("walkthrough.markStep", { step: step.content })
        }
      />

      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {labelKey ? (
            <Muted type="body-xs" className="font-semibold text-accent">
              {t(labelKey)}
            </Muted>
          ) : null}
          {/* `prefix` 是作者给的重点标记（★ 之类），放在内容前面 */}
          {step.prefix ? (
            <Muted type="body-xs" className="font-semibold text-accent">
              {step.prefix}
            </Muted>
          ) : null}
          <SpoilerText text={step.content} shield={shield} className="flex-1" />
        </View>

        {/* 存档 / 读档的备注（「初期」「第三章」）—— 没有它这条操作没法用 */}
        {step.subfix ? (
          <Muted type="body-xs" className="opacity-60">
            {step.subfix}
          </Muted>
        ) : null}
      </View>
    </View>
  );
}

/**
 * `memo` 是这里的关键，不是微优化：
 * 打标记时 `marks` 对象换新 → 整段所有行都会被父组件重新 reconcile；
 * 没有 `memo` 就是几百行一起重渲染（而每行还挂着 HeroUI 的 reanimated 复选框）。
 * 前提是 `onToggle` 引用稳定 —— 那由 `use-marks` 的 `useCallback` 保证。
 */
export const WalkthroughStepRow = memo(WalkthroughStepRowBase);
