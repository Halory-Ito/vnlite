/**
 * 清单条目表单（数据来自服务端的 `UListItem`）。
 *
 * 改动先落 draft；底部「保存」统一 diff 出一份 `UListPatch` 再 PATCH ——
 * 一次性提交。数据**不落本地库**：保存成功后失效查询、从 VNDB 重取。
 * 唯一的例外是「移出清单」：独立按钮 + 二次确认。
 */

import { useRouter } from "expo-router";
import { Button, Input, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { CoverImage } from "@/components/cover-image";
import { Muted, Paragraph } from "@/components/typo";
import { RatingBadge } from "@/components/ui";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/errors";
import type { UListItem, UListLabel } from "@/lib/api/types";
import { formatReleased } from "@/utils/format";

import { dateErrors, diffPatch, draftFrom, type UlistDraft } from "../entry-logic";
import { useUlistMutations } from "../hooks";
import { DateField } from "./date-field";
import { LabelField } from "./label-field";
import { VoteField } from "./vote-field";

export interface EntryFormProps {
  entry: UListItem;
  labels: readonly UListLabel[];
}

export function EntryForm({ entry, labels }: EntryFormProps): JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
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
        toast.show(t("ulist.savedToVndb"));
        router.back();
      },
      onError: (error) =>
        toast.show(error instanceof ApiError ? error.userMessage : t("ulist.saveFailed")),
    });
  };

  const remove = (): void => {
    removeEntry.mutate(undefined, {
      onSuccess: () => {
        toast.show(t("ulist.removed"));
        router.back();
      },
      onError: (error) =>
        toast.show(error instanceof ApiError ? error.userMessage : t("ulist.removeFailed")),
    });
  };

  const update = (part: Partial<UlistDraft>): void => setDraft((prev) => ({ ...prev, ...part }));

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ gap: 20, paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 头部：直接展示本次从 VNDB 拉到的作品信息；点标题进作品详情页 */}
      {entry.vn ? (
        <EntryHeader vn={entry.vn} onPressTitle={() => router.push(`/vn/${entry.id}`)} />
      ) : null}

      <View className="gap-6 px-4">
        <VoteField vote={draft.vote} onChange={(vote) => update({ vote })} />
        <LabelField
          labelIds={draft.labels}
          labels={labels}
          onChange={(next) => update({ labels: next })}
        />
        <DateField
          label={t("ulist.startedDate")}
          value={draft.started}
          onChange={(started) => update({ started })}
          error={errors.started ? t(errors.started) : null}
        />
        <DateField
          label={t("ulist.finishedDate")}
          value={draft.finished}
          onChange={(finished) => update({ finished })}
          error={errors.finished ? t(errors.finished) : null}
        />
        <View className="gap-1.5">
          <Muted type="body-xs" className="font-medium">
            {t("ulist.notesLabel")}
          </Muted>
          <Input
            value={draft.notes}
            onChangeText={(notes) => update({ notes })}
            placeholder={t("ulist.notesPlaceholder")}
            multiline
            style={{ minHeight: 96, textAlignVertical: "top" }}
            accessibilityLabel={t("ulist.notes")}
          />
        </View>
      </View>

      <View className="px-4">
        <Button size="sm" onPress={save} isDisabled={!patch || busy}>
          <Button.Label>{busy ? t("ulist.processing") : t("ulist.saveChanges")}</Button.Label>
        </Button>
      </View>

      <View className="gap-2 px-4">
        {confirmRemove ? (
          <View className="flex-row gap-2">
            <Button size="sm" variant="danger-soft" onPress={remove} isDisabled={busy}>
              <Button.Label>{t("ulist.confirmRemove")}</Button.Label>
            </Button>
            <Button size="sm" variant="secondary" onPress={() => setConfirmRemove(false)}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        ) : (
          <Button size="sm" variant="danger-soft" onPress={() => setConfirmRemove(true)}>
            <Button.Label>{t("ulist.removeFromList")}</Button.Label>
          </Button>
        )}
        <Muted type="body-xs">{t("ulist.removeHint")}</Muted>
      </View>
    </ScrollView>
  );
}

/** 头部：展示本次从 VNDB 拉到的作品信息（封面 / 标题 / 评分 / 发售日） */
function EntryHeader({
  vn,
  onPressTitle,
}: {
  vn: NonNullable<UListItem["vn"]>;
  /** 点标题进作品详情页（编辑页本身是导航死胡同，出口就挂在标题上） */
  onPressTitle: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 px-4">
      <CoverImage
        url={vn.image?.thumbnail ?? vn.image?.url}
        width={56}
        height={[56, 78]}
        roundedClassName="rounded-md"
        sexual={vn.image?.sexual}
        violence={vn.image?.violence}
        accessibilityLabel={t("ulist.coverLabel", { title: vn.title })}
      />
      <View className="flex-1 gap-1">
        <Pressable
          onPress={onPressTitle}
          className="active:opacity-60"
          accessibilityRole="link"
          accessibilityLabel={t("ulist.openVnDetails", { title: vn.title })}
          hitSlop={4}
        >
          {/* 站内链接色：标题现在同时是「进详情页」的入口 */}
          <Paragraph className="line-clamp-2 text-sm font-medium text-link">{vn.title}</Paragraph>
        </Pressable>
        <View className="flex-row flex-wrap items-center gap-2">
          <RatingBadge rating={vn.rating} votecount={vn.votecount} />
          <Muted type="body-xs">{formatReleased(vn.released)}</Muted>
        </View>
      </View>
    </View>
  );
}
