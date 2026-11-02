import { Body, Muted } from "@/components/typo";
import { formatPlayDuration } from "@/features/play-records/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { usePreferences } from "@/hooks/use-preferences";

import { GoalProgressRing } from "./goal-progress-ring";
import { DailyPlayGoal } from "./daily-play-goal";

export function TodayPlayDuration({ durationMs }: { durationMs: number }) {
  const { t } = useTranslation();
  const { dailyPlayGoalMinutes } = usePreferences();
  return (
    <DailyPlayGoal>
      {(onPress) => (
        <GoalProgressRing
          onPress={onPress}
          value={durationMs}
          goal={dailyPlayGoalMinutes * 60000}
          label={t("home.todayPlay")}
          text={t("home.dailyDurationProgress", {
            duration: formatPlayDuration(durationMs),
            minutes: dailyPlayGoalMinutes,
          })}
        >
          <Body type="body-sm" className="text-center font-semibold">
            {formatPlayDuration(durationMs)}
          </Body>
          <Muted type="body-xs" className="text-center">
            {t("home.dayDurationScale", { minutes: dailyPlayGoalMinutes })}
          </Muted>
        </GoalProgressRing>
      )}
    </DailyPlayGoal>
  );
}
