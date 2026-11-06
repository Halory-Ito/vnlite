import { Button, Input } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { AppDialog } from "@/components/dialog";
import { Body, H5, Muted } from "@/components/typo";
import { usePreference } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";
import { DEFAULT_ANNUAL_GAME_GOAL, setPreference } from "@/lib/storage/preferences";
import { GoalProgressRing } from "./goal-progress-ring";
import { GoalRingSkeleton } from "./goal-ring-skeleton";
import { TabletGoalBar } from "./tablet-goal-bar";

export function AnnualGoal({
  year,
  finished,
  status,
  onRetry,
  tablet = false,
}: {
  year: number;
  finished: number;
  status: "ready" | "loading" | "error" | "guest";
  onRetry: () => void;
  tablet?: boolean;
}) {
  const { t } = useTranslation();
  const annualGameGoals = usePreference("annualGameGoals");
  const goal = annualGameGoals[String(year)] ?? DEFAULT_ANNUAL_GAME_GOAL;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const valid = /^\d{1,4}$/.test(value) && Number(value) > 0;
  async function save() {
    setSaving(true);
    setFailed(false);
    try {
      await setPreference("annualGameGoals", { ...annualGameGoals, [year]: Number(value) });
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <View className="flex-1 items-center gap-1">
      <H5 className="min-h-5 text-center text-sm">{t("home.yearGoal")}</H5>
      {status === "loading" ? (
        tablet ? (
          <View className="w-full gap-3 py-3">
            <View className="h-6 w-24 rounded-md bg-default-soft" />
            <View className="h-3 w-full rounded-full bg-default-soft" />
          </View>
        ) : (
          <GoalRingSkeleton />
        )
      ) : tablet ? (
        <TabletGoalBar
          value={status === "ready" ? finished : 0}
          goal={goal}
          label={t("home.yearGoal")}
          progressText={
            status === "ready"
              ? t("home.goalProgress", { count: finished, goal })
              : t(
                  status === "guest"
                    ? "home.goalLogin"
                    : status === "error"
                      ? "common.failed"
                      : "common.loading"
                )
          }
          mainText={status === "ready" ? `${finished} / ${goal}` : "—"}
          detailText={t("home.finishedUnit")}
          onPress={() => {
            setValue(String(goal));
            setFailed(false);
            setOpen(true);
          }}
        />
      ) : (
        <GoalProgressRing
          onPress={() => {
            setValue(String(goal));
            setFailed(false);
            setOpen(true);
          }}
          value={status === "ready" ? finished : 0}
          goal={goal}
          label={t("home.yearGoal")}
          text={
            status === "ready"
              ? t("home.goalProgress", { count: finished, goal })
              : t(
                  status === "guest"
                    ? "home.goalLogin"
                    : status === "error"
                      ? "common.failed"
                      : "common.loading"
                )
          }
        >
          <Body type="body-sm" className="text-center font-semibold">
            {status === "ready" ? finished : "—"} / {goal}
          </Body>
          <Muted type="body-xs" className="text-center">
            {t("home.finishedUnit")}
          </Muted>
        </GoalProgressRing>
      )}
      {status !== "ready" && status !== "loading" ? (
        <View className="items-center justify-center">
          <Muted className="text-center">
            {t(
              status === "guest"
                ? "home.goalLogin"
                : status === "error"
                  ? "common.failed"
                  : "common.loading"
            )}
          </Muted>
          {status === "error" ? (
            <Button size="sm" variant="ghost" onPress={onRetry}>
              <Button.Label>{t("common.retry")}</Button.Label>
            </Button>
          ) : null}
        </View>
      ) : null}
      <AppDialog isOpen={open} onClose={() => setOpen(false)} title={t("home.yearGoal")}>
        <View className="gap-4">
          <Input
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel={t("home.targetGames")}
          />
          {failed ? <Muted>{t("common.failed")}</Muted> : null}
          <Button isDisabled={!valid || saving} onPress={() => void save()}>
            <Button.Label>{t("common.save")}</Button.Label>
          </Button>
        </View>
      </AppDialog>
    </View>
  );
}
