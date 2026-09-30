/**
 * VN 详情页的清单入口。
 *
 * 已加入 → 显示「已加入 · 88 / 未打分」，点击进清单编辑页；
 * 未加入 → 显示「加入清单」，同样进编辑页（那里有完整的打分/标签表单）。
 *
 * 数据是**服务端直读**（`useUlistItem` 查 `/ulist`）—— 清单不落本地库，
 * 所以这里看到的就是 VNDB 的当前状态，不再有「本地没同步到」的误判。
 *
 * 只在有 `listwrite` 权限时渲染 —— 游客看到的是只读浏览，不需要这个入口。
 */

import { useRouter } from "expo-router";
import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";

import { usePermission } from "@/hooks/useSession";

import { useUlistItem } from "../hooks";

export function UlistQuickButton({ vnId }: { vnId: string }): JSX.Element | null {
  const router = useRouter();
  const canWrite = usePermission("listwrite");
  const item = useUlistItem(vnId, canWrite);

  if (!canWrite) return null;

  const entry = item.data;
  const vote = entry?.vote ?? null;
  const busy = item.isLoading;

  return (
    <Pressable
      onPress={() => router.push(`/ulist/${vnId}`)}
      disabled={busy}
      className={`self-start rounded-full border px-3 py-1 active:opacity-70 ${
        entry ? "border-accent bg-accent-soft" : "border-border bg-default-soft"
      }`}
      accessibilityRole="button"
      accessibilityLabel={entry ? "编辑清单条目" : "加入清单"}
      accessibilityState={{ disabled: busy }}
    >
      <Typography
        type="body-xs"
        className={entry ? "font-semibold text-accent-soft-foreground" : "text-accent"}
      >
        {entry
          ? `已加入 · ${vote != null ? `${vote} 分` : "未打分"}`
          : busy
            ? "查询清单…"
            : "＋ 加入清单"}
      </Typography>
    </Pressable>
  );
}
