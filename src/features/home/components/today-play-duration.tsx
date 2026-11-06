import { Body, Muted } from "@/components/typo";
import { formatPlayDuration } from "@/features/play-records/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { usePreference } from "@/hooks/use-preferences";

import { GoalProgressRing } from "./goal-progress-ring";
import { DailyPlayGoal } from "./daily-play-goal";
import { TabletGoalBar } from "./tablet-goal-bar";

export function TodayPlayDuration({
  durationMs,
  tablet = false,
}: {
  durationMs: number;
  tablet?: boolean;
}) {
  const { t } = useTranslation();
  const dailyPlayGoalMinutes = usePreference("dailyPlayGoalMinutes");
  return (
    <DailyPlayGoal>
      {(onPress) => {
        const progressText = t("home.dailyDurationProgress", {
          duration: formatPlayDuration(durationMs),
          minutes: dailyPlayGoalMinutes,
        });
        return tablet ? (
          <TabletGoalBar
            value={durationMs}
            goal={dailyPlayGoalMinutes * 60000}
            label={t("home.todayPlay")}
            progressText={progressText}
            mainText={formatPlayDuration(durationMs)}
            detailText={t("home.dayDurationScale", { minutes: dailyPlayGoalMinutes })}
            onPress={onPress}
          />
        ) : (
          <GoalProgressRing
            onPress={onPress}
            value={durationMs}
            goal={dailyPlayGoalMinutes * 60000}
            label={t("home.todayPlay")}
            text={progressText}
          >
            <Body type="body-sm" className="text-center font-semibold">
              {formatPlayDuration(durationMs)}
            </Body>
            <Muted type="body-xs" className="text-center">
              {t("home.dayDurationScale", { minutes: dailyPlayGoalMinutes })}
            </Muted>
          </GoalProgressRing>
        );
      }}
    </DailyPlayGoal>
  );
}
