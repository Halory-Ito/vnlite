import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "heroui-native";
import { useState } from "react";
import { Platform } from "react-native";

import {
  openReleaseCalendar,
  openReleaseReminder,
  releaseReminderKey,
} from "@/features/home/lib/release-reminders";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import { kv } from "@/lib/storage/key-value";
import { ReleaseReminderDialog } from "./release-reminder-dialog";

type Mode = "saved" | "cancel" | "deleted" | "error" | null;

export function ReleaseReminderButton({ vn, date }: { vn: VnSummary; date: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const key = releaseReminderKey(vn.id, date);
  const queryKey = ["release-reminder", key];
  const status = useQuery({ queryKey, queryFn: () => kv.get<string>(key) });
  const [mode, setMode] = useState<Mode>(null);
  const [error, setError] = useState("");
  const showError = (message: string) => {
    setError(message);
    setMode("error");
  };
  const mutation = useMutation({
    mutationFn: async (action: "open" | "calendar" | "save" | "remove") => {
      if (action === "open") {
        await openReleaseReminder(
          vn.id,
          date,
          t("home.calendarReminderTitle", { title: vn.title })
        );
      } else if (action === "calendar") {
        await openReleaseCalendar(date);
      } else if (action === "save") {
        await kv.set(key, "user-confirmed");
        client.setQueryData(queryKey, "user-confirmed");
      } else {
        await kv.remove(key);
        client.setQueryData(queryKey, null);
      }
      return action;
    },
    onSuccess: (action) =>
      setMode(action === "open" ? "saved" : action === "calendar" ? "deleted" : null),
    onError: () => showError(t("home.calendarReminderError")),
  });
  const pending = mutation.isPending;
  const title =
    mode === "error"
      ? t("common.errorTitle")
      : mode === "saved"
        ? t("home.calendarReminderConfirmTitle")
        : t("home.calendarReminderCancel");
  const message =
    mode === "error"
      ? error
      : mode === "saved"
        ? t("home.calendarReminderConfirmMessage")
        : mode === "cancel"
          ? t("home.calendarReminderCancelMessage")
          : t("home.calendarReminderDeletedMessage");
  const confirm =
    mode === "error"
      ? t("common.confirm")
      : mode === "saved"
        ? t("home.calendarReminderSaved")
        : mode === "cancel"
          ? t("home.calendarReminderOpenCalendar")
          : t("home.calendarReminderDeleted");
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="self-center"
        accessibilityLabel={t(
          status.data ? "home.calendarReminderCancel" : "home.calendarReminder"
        )}
        isDisabled={status.isPending || status.isError || pending || mode !== null}
        onPress={(event) => {
          event.stopPropagation();
          if (Platform.OS !== "android" && Platform.OS !== "ios") {
            showError(t("home.calendarReminderUnsupported"));
          } else if (status.data) setMode("cancel");
          else mutation.mutate("open");
        }}
      >
        <Button.Label>
          {t(status.data ? "home.calendarReminderAdded" : "home.calendarReminder")}
        </Button.Label>
      </Button>
      <ReleaseReminderDialog
        open={mode !== null}
        title={title}
        message={message}
        confirm={confirm}
        pending={pending}
        cancel={
          mode === "error"
            ? undefined
            : mode === "saved"
              ? t("home.calendarReminderNotSaved")
              : mode === "deleted"
                ? t("home.calendarReminderNotDeleted")
                : t("common.cancel")
        }
        onClose={() => setMode(null)}
        onConfirm={() => {
          if (mode === "error") setMode(null);
          else
            mutation.mutate(mode === "saved" ? "save" : mode === "cancel" ? "calendar" : "remove");
        }}
      />
    </>
  );
}
