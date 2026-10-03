/**
 * 结局的步骤列表。
 *
 * ## 为什么必须分批挂载
 *
 * 实测最长的一篇攻略里，单个结局有 **171 步**（3 个结局超过 100 步）。
 * 一行里有 1 个 HeroUI \`Checkbox\`——它内部是 \`Animated.createAnimatedComponent\` +
 * 3 个 shared value（scale / opacity+translateX），比普通 View 重一个量级。
 * 171 行一次性挂载 = 一次提交里建几百个组件与动画节点，**展开瞬间明显卡顿**。
 *
 * 所以这里**先挂一小段、把点击的即时反馈立刻还给用户**，剩下的趁动画空闲分批补齐：
 *
 *   1. 首次只挂 \`FIRST_CHUNK\` 行 → 点一下立刻展开
 *   2. \`InteractionManager.runAfterInteractions\` 在动画结束后再加 \`CHUNK\` 行
 *   3. 超过 \`AUTO_CAP\` 就不再自动补，剩下给「显示更多」按钮
 *
 * ## 为什么不用 FlashList 虚拟化
 *
 * 页签的滚动容器是外层的 \`ScrollView\`（页头 + 线路 + 结局都在里面）。
 * 把竖向虚拟列表嵌进竖向 \`ScrollView\` 是典型的「nested VirtualizedLists」，
 * 两个滚动容器会互相抢手势。分批挂载没有这个冲突，且能做到同样的「首屏不卡」。
 *
 * 代价是超长结局滚到底仍有节点上限（\`AUTO_CAP\`），必要时再换成虚拟列表。
 */

import type { JSX } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { InteractionManager, Pressable, View } from "react-native";

import { Muted } from "@/components/typo";

import type { WalkthroughMarkApi } from "../use-marks";
import { groupSteps } from "../select";
import type { WalkthroughStep } from "../types";
import { WalkthroughStepRow } from "./walkthrough-step-row";

/** 首次展开先挂这么多行（够填满好几屏，且一次提交不会卡） */
const FIRST_CHUNK = 60;
/** 之后每次自动补多少行 */
const CHUNK = 60;
/**
 * 自动补到这么多行就停，之后交给「显示更多」。
 *
 * 定这个上限是为了**给未来的数据兜底**：现在最长结局 171 行，
 * 早就低于它；万一哪天仓库里出现 500 步的结局，也不至于一次性挂 500 个动画节点。
 */
const AUTO_CAP = 240;

export interface WalkthroughStepsProps {
  steps: readonly WalkthroughStep[];
  /** 剧透保护是否生效 */
  shield: boolean;
  marks: WalkthroughMarkApi;
}

function WalkthroughStepsBase({ steps, shield, marks }: WalkthroughStepsProps): JSX.Element {
  const [limit, setLimit] = useState(() => Math.min(steps.length, FIRST_CHUNK));

  /*
   * 趁动画空闲把剩下的分批补齐。
   *
   * ⚠️ 必须清理掉未执行的回调：`Accordion.Content` 在收起时整体卸载，
   * 不 cancel 的话会对同一个结局重复排队，展开几次就越挂越多。
   */
  useEffect(() => {
    if (limit >= steps.length || limit >= AUTO_CAP) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      setLimit((n) => Math.min(steps.length, AUTO_CAP, n + CHUNK));
    });
    return () => handle.cancel();
  }, [limit, steps.length]);

  const visible = useMemo(() => groupSteps(steps.slice(0, limit)), [steps, limit]);
  const rest = steps.length - limit;

  return (
    <View className="gap-3">
      {visible.map((group) => (
        <View key={group.key} className="gap-1.5">
          {group.title ? <GroupTitle title={group.title} /> : null}
          {group.steps.map((step) => (
            <WalkthroughStepRow
              key={step.id}
              step={step}
              shield={shield}
              done={marks.isDone(step.id)}
              onToggle={marks.toggleStep}
            />
          ))}
        </View>
      ))}

      {rest > 0 ? (
        <Pressable
          onPress={() => setLimit((n) => Math.min(steps.length, n + CHUNK))}
          className="self-start active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={`显示更多步骤，还有 ${rest} 步`}
        >
          <Muted type="body-xs" className="text-link">
            显示更多（还有 {rest} 步）
          </Muted>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * `memo` 是配合行级 `memo` 的第二道保险：Accordion 根的展开状态一变，
 * 所有 Item 都会重渲染；这里 props 不变就能整体跳过，省掉一次
 * 「几百行重新对账」的遍历（虽然行本身也会 bail out）。
 */
export const WalkthroughSteps = memo(WalkthroughStepsBase);

/** 章节标题 + 一条分隔线 */
function GroupTitle({ title }: { title: string }): JSX.Element {
  return (
    <View className="flex-row items-center gap-2 py-1">
      <Muted type="body-xs" className="font-semibold text-accent">
        {title}
      </Muted>
      <View className="h-px flex-1 bg-separator" />
    </View>
  );
}
