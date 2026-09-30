/**
 * 清单列表行。
 *
 * 复用 `VnListItem`（封面 / 标题 / 元信息），右侧放「我的打分」+
 * 状态标签 + 自建标签数量。标签名直接用 **VNDB 返回的英文原名**。
 * 点整行进入清单编辑页（不是 VN 详情页 —— 从清单来的用户第一诉求是改打分/标签）。
 */

import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/Typo";
import { VnListItem } from "@/features/vn/components/VnListItem";
import type { UListItem } from "@/lib/api/types";

import { VoteBadge } from "./VoteBadge";

export interface UlistItemRowProps {
  item: UListItem;
  onPress: (vnId: string) => void;
}

export function UlistItemRow({ item, onPress }: UlistItemRowProps): JSX.Element {
  /*
   * ⚠️ `/ulist` 返回的 `vn` 子对象**没有 `id`**：它和顶层 `id` 相同，VNDB 会省略
   * （请求了 `vn.id` 也不返回）。而 `VnListItem` 的点击回调给的是 `vn.id` ——
   * 直接用会跳去 `/ulist/undefined`，编辑页再拿 "undefined" 当过滤器 → VNDB 400。
   * 所以这里用顶层 `item.id` 把 `vn.id` 补齐，并在 `onPress` 里再兜一层。
   * VN 摘要整体缺失（字段集变更）时退化成只有 id + 标题。
   */
  const vn = { ...item.vn, id: item.id, title: item.vn?.title ?? item.id };
  const labels = item.labels ?? [];
  const status = labels.find((label) => label.id >= 1 && label.id <= 5);
  const custom = labels.filter((label) => label.id >= 10);

  return (
    <VnListItem
      vn={vn}
      onPress={() => onPress(item.id)}
      trailing={
        <View className="items-end justify-center gap-1">
          <VoteBadge vote={item.vote} />
          {status ? (
            <View className="rounded bg-accent-soft px-1.5 py-0.5">
              <Muted type="body-xs" className="text-[10px] text-accent-soft-foreground">
                {status.label}
              </Muted>
            </View>
          ) : null}
          {custom.length === 1 ? (
            <Muted type="body-xs" className="text-[10px]">
              {custom[0]?.label}
            </Muted>
          ) : null}
          {custom.length > 1 ? (
            <Muted type="body-xs" className="text-[10px]">
              +{custom.length} labels
            </Muted>
          ) : null}
        </View>
      }
    />
  );
}
