/**
 * 清单条目表单（数据来自服务端的 `UListItem`）。
 *
 * 改动先落 draft；底部「保存」统一 diff 出一份 `UListPatch` 再 PATCH ——
 * 一次性提交。数据**不落本地库**：保存成功后失效查询、从 VNDB 重取。
 * 唯一的例外是「移出清单」：独立按钮 + 二次确认。
 */

import { Link, useRouter } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { CoverImage } from "@/components/CoverImage";
import { Muted, Paragraph } from "@/components/Typo";
import { RatingBadge } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";
import type { UListItem, UListLabel } from "@/lib/api/types";
import { formatReleased } from "@/utils/format";

import { dateErrors, diffPatch, draftFrom, type UlistDraft } from "../entryLogic";
import { useUlistMutations } from "../hooks";
import { DateField } from "./DateField";
import { LabelField } from "./LabelField";
import { VoteField } from "./VoteField";

export interface EntryFormProps {
  entry: UListItem;
  labels: readonly UListLabel[];
}

export function EntryForm({ entry, labels }: EntryFormProps): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { updateEntry, removeEntry } = useUlistMutations(entry.id);
  const [draft, setDraft] = useState<UlistDraft>(() => draftFrom(entry));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const errors = dateErrors(draft.started, draft.finished);
  const patch = errors.started || errors.finished ? null : diffPatch(entry, draft);
  const busy = updateEntry.isPending || removeEntry.isPending;

  const save = (): void => {
    if (!patch) return;
    updateEntry.mutate(patch, {
      onSuccess: () => {
        toast.show("已保存到 VNDB");
        router.back();
      },
      onError: (error) =>
        toast.show(error instanceof ApiError ? error.userMessage : "保存失败，请重试"),
    });
  };

  const remove = (): void => {
    removeEntry.mutate(undefined, {
      onSuccess: () => {
        toast.show("已移出清单");
        router.back();
      },
      onError: (error) =>
        toast.show(error instanceof ApiError ? error.userMessage : "移出失败，请重试"),
    });
  };

  const update = (part: Partial<UlistDraft>): void => setDraft((prev) => ({ ...prev, ...part }));

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ gap: 20, paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 头部：直接展示本次从 VNDB 拉到的作品信息 */}
      {entry.vn ? <EntryHeader vn={entry.vn} /> : null}

      <View className="gap-6 px-4">
        <VoteField vote={draft.vote} onChange={(vote) => update({ vote })} />
        <LabelField
          labelIds={draft.labels}
          labels={labels}
          onChange={(next) => update({ labels: next })}
        />
        <DateField
          label="开始日期"
          value={draft.started}
          onChange={(started) => update({ started })}
          error={errors.started}
        />
        <DateField
          label="完成日期"
          value={draft.finished}
          onChange={(finished) => update({ finished })}
          error={errors.finished}
        />
        <View className="gap-1.5">
          <Muted type="body-xs" className="font-medium">
            备注（仅自己可见）
          </Muted>
          <Input
            value={draft.notes}
            onChangeText={(notes) => update({ notes })}
            placeholder="写点感想…"
            multiline
            style={{ minHeight: 96, textAlignVertical: "top" }}
            accessibilityLabel="备注"
          />
        </View>
      </View>

      <View className="px-4">
        <Button size="sm" onPress={save} isDisabled={!patch || busy}>
          <Button.Label>{busy ? "处理中…" : "保存更改"}</Button.Label>
        </Button>
      </View>

      <View className="gap-2 px-4">
        {confirmRemove ? (
          <View className="flex-row gap-2">
            <Button size="sm" variant="danger-soft" onPress={remove} isDisabled={busy}>
              <Button.Label>确认移出</Button.Label>
            </Button>
            <Button size="sm" variant="secondary" onPress={() => setConfirmRemove(false)}>
              <Button.Label>取消</Button.Label>
            </Button>
          </View>
        ) : (
          <Button size="sm" variant="danger-soft" onPress={() => setConfirmRemove(true)}>
            <Button.Label>移出清单</Button.Label>
          </Button>
        )}
        <Muted type="body-xs">移出会同时删除该作品的全部发行版持有记录，且不可撤销</Muted>
      </View>

      {/* 编辑页是导航死胡同，给一个回作品详情的出口 */}
      <View className="px-4">
        <Link href={`/vn/${entry.id}`} asChild>
          <Button size="sm" variant="secondary">
            <Button.Label>查看作品详情</Button.Label>
          </Button>
        </Link>
      </View>
    </ScrollView>
  );
}

/** 头部：展示本次从 VNDB 拉到的作品信息（封面 / 标题 / 评分 / 发售日） */
function EntryHeader({ vn }: { vn: NonNullable<UListItem["vn"]> }): JSX.Element {
  return (
    <View className="flex-row items-center gap-3 px-4">
      <CoverImage
        url={vn.image?.thumbnail ?? vn.image?.url}
        width={56}
        height={[56, 78]}
        roundedClassName="rounded-md"
        sexual={vn.image?.sexual}
        violence={vn.image?.violence}
        accessibilityLabel={`${vn.title} 封面`}
      />
      <View className="flex-1 gap-1">
        <Paragraph className="line-clamp-2 text-sm font-medium">{vn.title}</Paragraph>
        <View className="flex-row flex-wrap items-center gap-2">
          <RatingBadge rating={vn.rating} votecount={vn.votecount} />
          <Muted type="body-xs">{formatReleased(vn.released)}</Muted>
        </View>
      </View>
    </View>
  );
}
