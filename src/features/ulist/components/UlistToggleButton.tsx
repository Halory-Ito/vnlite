/**
 * VN 详情页右上角的清单开关。
 *
 * 未加入 → 「加入清单」（PATCH 空 patch 即创建条目）；已加入 → 「移除」。
 * 分工：这里只管「在不在清单里」；打分 / 标签 / 备注去编辑页
 * （入口是同目录的 `UlistEditEntry`）。
 *
 * ⚠️ 移除必须二次确认：`DELETE /ulist` 会**连带删除**该作品的发行版持有记录，
 * 且不可撤销（项目铁律，见 `lib/api/endpoints/ulist.ts` 顶部说明）。
 */

import { useToast, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Alert, Pressable } from "react-native";

import { Icon } from "@/components/Icon";
import { Muted } from "@/components/Typo";
import { usePermission } from "@/hooks/useSession";
import { ApiError } from "@/lib/api/errors";

import { useUlistItem, useUlistMutations } from "../hooks";

export function UlistToggleButton({ vnId }: { vnId: string }): JSX.Element | null {
  const canWrite = usePermission("listwrite");
  const item = useUlistItem(vnId, canWrite);
  const { updateEntry, removeEntry } = useUlistMutations(vnId);
  const { toast } = useToast();
  const accent = useThemeColor("accent");
  const danger = useThemeColor("danger");

  // 游客 / 只有 listread 的 token：详情页保持只读，不出现这个按钮
  if (!canWrite) return null;

  const inList = item.data != null;
  const busy = item.isLoading || updateEntry.isPending || removeEntry.isPending;

  const reportError = (error: unknown, fallback: string): void => {
    toast.show(error instanceof ApiError ? error.userMessage : fallback);
  };

  const add = (): void => {
    updateEntry.mutate(
      {},
      {
        onSuccess: () => toast.show("已加入清单"),
        onError: (error) => reportError(error, "加入失败，请重试"),
      }
    );
  };

  const remove = (): void => {
    removeEntry.mutate(undefined, {
      onSuccess: () => toast.show("已移出清单"),
      onError: (error) => reportError(error, "移出失败，请重试"),
    });
  };

  const confirmRemove = (): void => {
    Alert.alert("移出清单", "会同时删除该作品的全部发行版持有记录，且不可撤销。", [
      { text: "取消", style: "cancel" },
      { text: "移出", style: "destructive", onPress: remove },
    ]);
  };

  return (
    <Pressable
      onPress={inList ? confirmRemove : add}
      disabled={busy}
      className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
        busy ? "opacity-50" : "active:opacity-70"
      } ${inList ? "border-border" : "border-accent"}`}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={inList ? "移出清单" : "加入清单"}
      accessibilityState={{ disabled: busy }}
    >
      {/* 图标只能吃具体色值（不吃 className），所以走主题 accent / danger */}
      <Icon name={inList ? "trashBin" : "plus"} size={14} color={inList ? danger : accent} />
      <Muted type="body-xs" className={inList ? "text-danger" : "text-accent"}>
        {inList ? "移除" : "加入清单"}
      </Muted>
    </Pressable>
  );
}
