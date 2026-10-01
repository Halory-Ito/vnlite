/**
 * 发行版持有状态选择（VN 详情 · 版本页签用）。
 *
 * 状态值来自 `/rlist`：1 Pending / 2 Obtained / 3 On loan（英文与 VNDB 一致）。
 * 再点一次已选中的状态 = 移除持有记录（`DELETE /rlist/{id}`）。
 *
 * 数据是**服务端直读**：当前状态从 `useUlistItem(vnId)` 的 `releases` 里取；
 * 本地没有清单镜像，所以不去猜 —— 写完后失效查询、从 VNDB 重取。
 */

import { useToast } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { usePermission } from "@/hooks/use-session";
import { ApiError } from "@/lib/api/errors";
import type { UListRelease } from "@/lib/api/types";
import { listStatusLabel } from "@/utils/format";

import { useUlistItem, useUlistReleaseHold } from "../hooks";
import { Pill } from "./pill";

/** 常用三档（0 Unknown / 4 Deleted 不给选），英文名来自 VNDB 的 list_status */
const HOLD_OPTIONS = [1, 2, 3] as const;

export interface ReleaseHoldChipsProps {
  vnId: string;
  release: UListRelease;
}

export function ReleaseHoldChips({ vnId, release }: ReleaseHoldChipsProps): JSX.Element | null {
  const canWrite = usePermission("listwrite");
  const item = useUlistItem(vnId, canWrite);
  const hold = useUlistReleaseHold();
  const { toast } = useToast();

  if (!canWrite) return null;

  const current = item.data?.releases?.find((r) => r.id === release.id)?.list_status ?? null;

  const toggle = (status: number): void => {
    hold.mutate(
      { releaseId: release.id, status: current === status ? null : status },
      {
        onError: (error) =>
          toast.show(error instanceof ApiError ? error.userMessage : "更新失败，请重试"),
      }
    );
  };

  return (
    <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
      <Muted type="body-xs" className="text-[10px]">
        Hold
      </Muted>
      {HOLD_OPTIONS.map((status) => (
        <Pill
          key={status}
          label={listStatusLabel(status)}
          active={current === status}
          onPress={() => toggle(status)}
        />
      ))}
      {item.isLoading ? (
        <Muted type="body-xs" className="text-[10px]">
          查询中…
        </Muted>
      ) : null}
    </View>
  );
}
