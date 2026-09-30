/**
 * 清单标签选择：内置状态（互斥，单选效果）+ 自建标签（多选）。
 *
 * 名称一律用 **VNDB 的英文原名**（服务端 `GET /ulist_labels` 返回什么显示什么，
 * 加载失败时用内置英文名兜底）。
 *
 * 互斥收敛交给 `endpoints/ulist.ts` 的 `toggleLabel`（API 不帮你收敛，
 * 同传 1 和 2 会真的都写进去）。
 */

import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/Typo";
import { BUILTIN_LABEL_NAME, EXCLUSIVE_STATUS_LABELS } from "@/lib/api/enums";
import { toggleLabel } from "@/lib/api/endpoints/ulist";
import type { UListLabel } from "@/lib/api/types";

import { Pill } from "./Pill";

export interface LabelFieldProps {
  labelIds: number[];
  /** 服务端标签集（含自建）；还没加载出来时用内置英文名兜底 */
  labels: readonly UListLabel[];
  onChange: (next: number[]) => void;
}

export function LabelField({ labelIds, labels, onChange }: LabelFieldProps): JSX.Element {
  const custom = labels.filter((label) => label.id >= 10);
  const nameOf = (id: number): string =>
    labels.find((label) => label.id === id)?.label ?? BUILTIN_LABEL_NAME[id] ?? `Label ${id}`;

  return (
    <View className="gap-3">
      <View className="gap-2">
        <Muted type="body-xs" className="font-medium">
          状态（点已选中的可取消）
        </Muted>
        <View className="flex-row flex-wrap gap-1.5">
          {EXCLUSIVE_STATUS_LABELS.map((id) => (
            <Pill
              key={id}
              label={nameOf(id)}
              active={labelIds.includes(id)}
              onPress={() => onChange(toggleLabel(labelIds, id))}
            />
          ))}
        </View>
      </View>

      {custom.length > 0 ? (
        <View className="gap-2">
          <Muted type="body-xs" className="font-medium">
            自建标签
          </Muted>
          <View className="flex-row flex-wrap gap-1.5">
            {custom.map((label) => (
              <Pill
                key={label.id}
                label={label.label}
                active={labelIds.includes(label.id)}
                onPress={() => onChange(toggleLabel(labelIds, label.id))}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
