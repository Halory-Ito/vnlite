/**
 * 打分列表的一行：标题（可点进作品详情）+ 打开的各列。
 *
 * 每列都是「标签 + 值」两个独立元素、靠间距排开 —— 不用 `内容 · 内容` 的拼接
 * （Master 不喜欢）。标题列关掉后每列自带标签，这一行照样读得懂。
 */

import { useRouter } from "expo-router";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Muted, Paragraph } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { UListItem } from "@/lib/api/types";

import type { VndbLengthVote } from "../scrape";
import {
  isAccentColumn,
  VOTE_FIELD_LABEL_KEY,
  voteColumnValue,
  type VoteColumn,
} from "../vote-columns";

export function VoteRow({
  item,
  visible,
  length,
}: {
  item: UListItem;
  visible: readonly VoteColumn[];
  length: VndbLengthVote | undefined;
}): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const title = item.vn?.title ?? item.id;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/vn/[id]", params: { id: item.id } })}
      className="gap-1 px-4 py-3 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={t("user.openVn", { title })}
    >
      {visible.includes("title") ? <Paragraph className="line-clamp-1">{title}</Paragraph> : null}

      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
        {visible
          .filter((column) => column !== "title")
          .map((column) => (
            <Field
              key={column}
              label={t(VOTE_FIELD_LABEL_KEY[column])}
              value={voteColumnValue(column, item, length) ?? "—"}
              accent={isAccentColumn(column)}
            />
          ))}
      </View>
    </Pressable>
  );
}

/** 「标签 + 值」一个小字段。标签与值是两个元素，中间靠间距 */
function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: boolean;
}): JSX.Element {
  return (
    <View className="flex-row items-center gap-1">
      <Muted type="body-xs" className="opacity-60">
        {label}
      </Muted>
      <Muted type="body-xs" className={accent ? "font-semibold text-accent" : undefined}>
        {value}
      </Muted>
    </View>
  );
}
