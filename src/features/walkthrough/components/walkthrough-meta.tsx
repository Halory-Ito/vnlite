/**
 * 攻略页签的头部：作者的 `tips` 提示与重点计数。
 *
 * ## tips 为什么必须放在最上面
 *
 * 攻略作者自己写的提示，绝大多数就是**剧透警告**（「请注意多周目后才会出现」）。
 * 放在最上面，才能在用户点开任何结局之前就看到。
 *
 * ## 剩下的部分为什么这么少
 *
 * 完整度 / 统计 / 更新时间 / 数据来源链接 / 进度小段这些原本都有，
 * 现按 Master 的要求精简掉了。这里只保留 `tips` 与重点计数 ——
 * `tips` 是作者给的内容，删了就等于吞掉作者的信息。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Muted, Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";

import type { MarkProgress } from "../select";
import type { Walkthrough } from "../types";

export interface WalkthroughMetaProps {
  walkthrough: Walkthrough;
  progress: MarkProgress;
}

export function WalkthroughMeta({ walkthrough, progress }: WalkthroughMetaProps): JSX.Element {
  const { t } = useTranslation();
  // 图标只能吃具体色值，不能写 className，也不能写 `currentColor`
  const warning = useThemeColor("warning");

  return (
    <View className="gap-2.5 px-4 pb-3 pt-2">
      {/* 重点计数：自己的进度不是剧透，所以明文显示 */}
      {progress.starredSteps > 0 ? (
        <View className="flex-row flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <Muted type="body-xs" className="opacity-60">
            {t("walkthrough.starred", { count: progress.starredSteps })}
          </Muted>
        </View>
      ) : null}

      {walkthrough.tips?.map((tip) => (
        <View key={tip} className="flex-row items-start gap-2 rounded-lg bg-warning-soft px-3 py-2">
          <Icon name="triangleExclamation" size={14} color={warning} />
          <Paragraph className="flex-1 text-xs leading-4 text-warning-soft-foreground">
            {tip}
          </Paragraph>
        </View>
      ))}
    </View>
  );
}
