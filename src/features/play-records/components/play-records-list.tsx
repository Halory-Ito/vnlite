/**
 * 游玩记录 · 列表视图。
 *
 * 每条记录是一张**卡片**：左右留白 `px-4`、行间 `gap-2`、`rounded-lg bg-default`
 * （`--default` 是**实色**，不透明，背景图不会透出来）。上面一行日期，下面一行起止时间，
 * 右侧时长。
 *
 * **左滑**露出两个 icon button：设置（齿轮，改起止时间）/ 删除（垃圾桶）。
 * `containerStyle` 上的 `overflow: hidden` + 圆角把左滑动作裁在圆角内；行内容与动作
 * 都铺不透明底色（滑动时动作在行下方，行必须不透明才遮得住）。
 *
 * 主题色在列表层取一次传下去，避免每行多次订阅。
 */

import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Pressable, ScrollView, View } from "react-native";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Icon, type IconName } from "@/components/icon";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { PlaySession } from "@/lib/db/dao/play-session";

import { formatClock, formatPlayDuration, formatSessionDate } from "../format";
import { useDeletePlaySession } from "../hooks";
import { SessionEditDialog } from "./session-edit-dialog";

export function PlayRecordsList({ sessions }: { sessions: PlaySession[] }): JSX.Element {
  const removeSession = useDeletePlaySession();
  const { t } = useTranslation();
  const accent = useThemeColor("accent");
  const danger = useThemeColor("danger");
  const [editing, setEditing] = useState<PlaySession | null>(null);
  const [deleting, setDeleting] = useState<PlaySession | null>(null);

  return (
    <>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="gap-2 px-4 pt-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              accent={accent}
              danger={danger}
              onEdit={() => setEditing(session)}
              onDelete={() => setDeleting(session)}
            />
          ))}
        </View>
      </ScrollView>

      {editing ? <SessionEditDialog session={editing} onClose={() => setEditing(null)} /> : null}

      {deleting ? (
        <ConfirmDialog
          isOpen
          title={t("records.list.deleteTitle")}
          description={t("records.list.deleteDescription")}
          confirmLabel={t("records.list.delete")}
          isPending={removeSession.isPending}
          onConfirm={() => {
            removeSession.mutate(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

/** 单条记录（卡片）：左滑露出「设置 / 删除」 */
function SessionRow({
  session,
  accent,
  danger,
  onEdit,
  onDelete,
}: {
  session: PlaySession;
  accent: string;
  danger: string;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={{ borderRadius: 12, overflow: "hidden" }}
      renderRightActions={(_progress, _translation, methods) => (
        <View className="flex-row items-center gap-2 bg-default pl-2 pr-4">
          <SwipeAction
            icon="gear"
            label={t("records.list.edit")}
            color={accent}
            onPress={() => {
              methods.close();
              onEdit();
            }}
          />
          <SwipeAction
            icon="trashBin"
            label={t("records.list.delete")}
            color={danger}
            onPress={onDelete}
          />
        </View>
      )}
    >
      <View className="flex-row items-center justify-between gap-3 bg-default px-4 py-3">
        <View className="flex-1 gap-0.5">
          <Muted type="body-sm" selectable={false}>
            {formatSessionDate(session.startedAt)}
          </Muted>
          <Muted type="body-xs" className="opacity-70" selectable={false}>
            {formatClock(session.startedAt)} – {formatClock(session.endedAt)}
          </Muted>
        </View>
        <Muted type="body-sm" className="font-semibold text-accent" selectable={false}>
          {formatPlayDuration(session.durationMs)}
        </Muted>
      </View>
    </ReanimatedSwipeable>
  );
}

/** 左滑露出的圆形 icon 按钮 */
function SwipeAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full bg-background active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}
