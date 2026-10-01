/**
 * 清单条目编辑页（`/ulist/[id]`）。
 *
 * 页面内容**完全由服务端数据渲染**（`useUlistItem` 直查 `/ulist`）：
 * 标题 / 封面来自条目里冗余的 `vn` 摘要，表单初值来自当前打分 / 标签 /
 * 备注 / 日期，改动直接 PATCH 回 VNDB。清单不落本地库。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { H5 } from "@/components/typo";

import { EntryForm } from "./components/entry-form";
import { NotInList } from "./components/not-in-list";
import { isVnId } from "./entry-logic";
import { useUlistItem, useUlistLabels } from "./hooks";

export function UlistEntryScreen(): JSX.Element {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  // 脏参数（如 `/ulist/undefined`）不发请求：VNDB 只会回 400，文案还看不懂
  const valid = isVnId(id);
  const item = useUlistItem(id, valid);
  const labels = useUlistLabels();
  const title = item.data?.vn?.title ?? id;

  return (
    <View className="flex-1">
      <BackBar title={title} />
      {!valid ? (
        <EmptyState
          title="无效的作品 ID"
          description="清单条目的链接不合法，请回到清单列表重新进入"
        />
      ) : item.isLoading ? (
        <LoadingState label="从 VNDB 拉取清单条目…" />
      ) : item.isError ? (
        <ErrorState error={item.error} onRetry={() => void item.refetch()} />
      ) : item.data ? (
        <EntryForm key={item.data.id} entry={item.data} labels={labels.data ?? []} />
      ) : (
        <NotInList vnId={id} />
      )}
    </View>
  );
}

function BackBar({ title }: { title: string }): JSX.Element {
  const router = useRouter();
  const muted = useThemeColor("muted");
  return (
    <View className="flex-row items-center gap-2 px-4 py-2">
      <Pressable
        onPress={() => router.back()}
        className="active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel="返回"
        hitSlop={8}
      >
        <Icon name="chevronLeft" size={24} color={muted} />
      </Pressable>
      <H5 numberOfLines={1} className="flex-1">
        {title}
      </H5>
    </View>
  );
}
