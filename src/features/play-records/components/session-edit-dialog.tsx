/**
 * 游玩记录 · 设置弹窗。
 *
 * 修改「开始时间」与「结束时间」，时长自动 = 两者之差（保存时写入）。走
 * 项目自己的 `AppDialog`。挂载即视为打开（父层用条件渲染控制），这样每次打开
 * 都会用当前记录重新初始化草稿。
 */

import { Button, Input } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { PlaySession } from "@/lib/db/dao/play-session";

import { useUpdatePlaySession } from "../hooks";
import {
  dateTimeFieldError,
  durationBetween,
  formatLocalDate,
  formatLocalTime,
  sessionRangeError,
  toLocalTimestamp,
} from "../session-time";

export interface SessionEditDialogProps {
  session: PlaySession;
  onClose: () => void;
}

export function SessionEditDialog({ session, onClose }: SessionEditDialogProps): JSX.Element {
  const update = useUpdatePlaySession();
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(() => formatLocalDate(session.startedAt));
  const [startTime, setStartTime] = useState(() => formatLocalTime(session.startedAt));
  const [endDate, setEndDate] = useState(() => formatLocalDate(session.endedAt));
  const [endTime, setEndTime] = useState(() => formatLocalTime(session.endedAt));
  const [error, setError] = useState<string | null>(null);

  const save = (): void => {
    const startMs = toLocalTimestamp(startDate, startTime);
    const endMs = toLocalTimestamp(endDate, endTime);
    if (startMs == null || endMs == null) {
      setError(
        dateTimeFieldError(startDate, startTime) ??
          dateTimeFieldError(endDate, endTime) ??
          t("records.edit.invalid")
      );
      return;
    }
    const rangeError = sessionRangeError(startMs, endMs);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    update.mutate(
      {
        id: session.id,
        timing: { startedAt: startMs, endedAt: endMs, durationMs: durationBetween(startMs, endMs) },
      },
      { onSuccess: onClose }
    );
  };

  return (
    <AppDialog isOpen onClose={onClose} title={t("records.edit.title")}>
      <View className="gap-4">
        <BoundaryFields
          label={t("records.edit.start")}
          date={startDate}
          time={startTime}
          onDate={setStartDate}
          onTime={setStartTime}
        />
        <BoundaryFields
          label={t("records.edit.end")}
          date={endDate}
          time={endTime}
          onDate={setEndDate}
          onTime={setEndTime}
        />

        {error ? (
          <Muted type="body-xs" className="text-danger-soft-foreground">
            {error}
          </Muted>
        ) : null}

        <View className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" onPress={onClose}>
            <Button.Label>{t("common.cancel")}</Button.Label>
          </Button>
          <Button size="sm" onPress={save} isDisabled={update.isPending}>
            <Button.Label>{t("common.save")}</Button.Label>
          </Button>
        </View>
      </View>
    </AppDialog>
  );
}

/** 一个边界（开始 / 结束）：日期 + 时间两个输入 */
function BoundaryFields({
  label,
  date,
  time,
  onDate,
  onTime,
}: {
  label: string;
  date: string;
  time: string;
  onDate: (next: string) => void;
  onTime: (next: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <View className="gap-1.5">
      <Muted type="body-xs" className="font-medium">
        {label}
      </Muted>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            value={date}
            onChangeText={onDate}
            placeholder={t("records.edit.datePlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("records.edit.dateField", { label })}
          />
        </View>
        <View style={{ width: 96 }}>
          <Input
            value={time}
            onChangeText={onTime}
            placeholder={t("records.edit.timePlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("records.edit.timeField", { label })}
          />
        </View>
      </View>
    </View>
  );
}
