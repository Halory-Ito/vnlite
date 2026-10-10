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
import { useState } from "react";
import { Pressable } from "react-native";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Icon } from "@/components/icon";
import { Muted } from "@/components/typo";
import { usePermission } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/errors";

import { useUlistItem, useUlistMutations } from "../hooks";

export function UlistToggleButton({ vnId }: { vnId: string }): JSX.Element | null {
  const canWrite = usePermission("listwrite");
  const item = useUlistItem(vnId, canWrite);
  const { updateEntry, removeEntry } = useUlistMutations(vnId);
  const { t } = useTranslation();
  const { toast } = useToast();
  const accent = useThemeColor("accent");
  const danger = useThemeColor("danger");
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        onSuccess: () => toast.show(t("ulist.added")),
        onError: (error) => reportError(error, t("ulist.addFailed")),
      }
    );
  };

  const remove = (): void => {
    removeEntry.mutate(undefined, {
      onSuccess: () => toast.show(t("ulist.removed")),
      onError: (error) => reportError(error, t("ulist.removeFailed")),
    });
  };

  const confirmRemove = (): void => setConfirmOpen(true);

  return (
    <>
      <Pressable
        onPress={inList ? confirmRemove : add}
        disabled={busy}
        className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${
          busy ? "opacity-50" : "active:opacity-70"
        } ${inList ? "border-border" : "border-accent"}`}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={inList ? t("ulist.removeFromList") : t("ulist.addToList")}
        accessibilityState={{ disabled: busy }}
      >
        {/* 图标只能吃具体色值（不吃 className），所以走主题 accent / danger */}
        <Icon name={inList ? "trashBin" : "plus"} size={14} color={inList ? danger : accent} />
        <Muted type="body-xs" className={inList ? "text-danger" : "text-accent"}>
          {inList ? t("ulist.remove") : t("ulist.addToList")}
        </Muted>
      </Pressable>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t("ulist.removeFromList")}
        description={t("ulist.removeConfirmDescription")}
        confirmLabel={t("ulist.removeConfirm")}
        isPending={removeEntry.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          remove();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
