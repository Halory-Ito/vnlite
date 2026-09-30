/**
 * 清单标签筛选条（胶囊行）。
 *
 * 筛选**下推给服务端**（Kana 的 `/ulist` 支持 `label` 过滤器），
 * 不再像旧版那样全量拉回本地再在 JS 里筛。
 * 标签名与数量都来自 `GET /ulist_labels`（**英文原名，不做翻译**）；
 * 虚拟标签（0 = No label、7 = Voted）不可筛选，直接不渲染。
 *
 * 排序 UI 已按 Master 要求移除（固定加入时间新 → 旧），所以这里不再有 caption。
 */

import type { JSX } from "react";
import { ScrollView, View } from "react-native";

import type { UListLabel } from "@/lib/api/types";

import { Pill } from "./Pill";

export interface UlistLabelFilterProps {
  labels: readonly UListLabel[];
  labelFilter: number | null;
  onLabelFilterChange: (id: number | null) => void;
}

export function UlistLabelFilter({
  labels,
  labelFilter,
  onLabelFilterChange,
}: UlistLabelFilterProps): JSX.Element | null {
  // 虚拟标签（0 = No label、7 = Voted）不可筛选
  const selectable = labels.filter((label) => label.id !== 0 && label.id !== 7);
  // 标签还没加载出来（或加载失败）时整条不渲染，列表直接顶上来
  if (selectable.length === 0) return null;

  return (
    <View className="flex-row px-4 pb-2 pt-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      >
        <Pill
          label="全部"
          active={labelFilter === null}
          onPress={() => onLabelFilterChange(null)}
        />
        {selectable.map((label) => (
          <Pill
            key={label.id}
            label={label.count != null ? `${label.label} ${label.count}` : label.label}
            active={labelFilter === label.id}
            onPress={() => onLabelFilterChange(labelFilter === label.id ? null : label.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
