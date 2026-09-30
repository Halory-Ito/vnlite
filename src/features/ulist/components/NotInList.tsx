/**
 * 「该 VN 不在清单里」的空态 + 加入入口。
 *
 * 这里的「不在」是**服务端确认过的**（父组件的 `useUlistItem` 直查 `/ulist`），
 * 不存在旧版「本地没同步到」的误导。
 * 加入 = `PATCH /ulist`（PATCH 本身就会创建条目），成功后查询失效、页面自动切成表单。
 */

import { Button, useToast } from "heroui-native";
import type { JSX } from "react";

import { EmptyState } from "@/components/ScreenState";
import { ApiError } from "@/lib/api/errors";

import { useUlistMutations } from "../hooks";

export function NotInList({ vnId }: { vnId: string }): JSX.Element {
  const { toast } = useToast();
  const { updateEntry } = useUlistMutations(vnId);

  const add = (): void => {
    updateEntry.mutate(
      {},
      {
        onSuccess: () => toast.show("已加入清单"),
        onError: (error) =>
          toast.show(error instanceof ApiError ? error.userMessage : "加入失败，请重试"),
      }
    );
  };

  return (
    <EmptyState
      title="还没有加入清单"
      description="加入后可以打分、贴标签、记录游玩进度；数据直接写回 VNDB"
      action={
        <Button size="sm" onPress={add} isDisabled={updateEntry.isPending}>
          <Button.Label>{updateEntry.isPending ? "加入中…" : "加入清单"}</Button.Label>
        </Button>
      }
    />
  );
}
