import { Button, Card, Skeleton } from "heroui-native";
import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";

import { H5 } from "@/components/typo";
import { useHomePlaySummary } from "@/features/home/hooks/use-play-summary";
import { dailyPlaySummary, localDayKey, yearlyFinished } from "@/features/home/lib/play-summary";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";

import { AnnualGoal } from "./annual-goal";
import { PlayHeatmap } from "./play-heatmap";
import { TodayPlayDuration } from "./today-play-duration";
import { GoalRingSkeleton } from "./goal-ring-skeleton";

type StatSection = "today" | "annual" | "heatmap";

export function HomePlayStats({ sections }: { sections: StatSection[] }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const surface = useTranslucentSurface();
  const { sessions, completed, canRead, now, isSessionLoading } = useHomePlaySummary(
    sections.some((id) => id !== "annual"),
    sections.includes("annual")
  );
  const days = useMemo(() => dailyPlaySummary(sessions.data ?? []), [sessions.data]);
  const today = days.get(localDayKey(now));
  const year = now.getFullYear();
  if (sections[0] === "heatmap")
    return (
      <Card className="mx-4 my-3" style={surface}>
        <Card.Body>
          {sessions.isPending ? (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Skeleton className="h-5 w-28 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </View>
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-3 w-28 self-end rounded-md" />
            </View>
          ) : sessions.isError ? (
            <Button size="sm" variant="ghost" onPress={() => void sessions.refetch()}>
              <Button.Label>{t("common.retry")}</Button.Label>
            </Button>
          ) : (
            <PlayHeatmap days={days} now={now} />
          )}
        </Card.Body>
      </Card>
    );
  return (
    <View
      className="my-3 flex-row items-stretch gap-3 self-center"
      style={{ width: Math.max(0, width - 32) }}
    >
      {sections.map((id) => (
        <Card key={id} className="min-w-0 flex-1 p-2.5" style={surface}>
          <Card.Body className="flex-1 items-center gap-1">
            {id === "today" ? (
              <View className="w-full flex-1 items-center gap-1">
                <H5 className="min-h-5 text-center text-sm">{t("home.todayPlay")}</H5>
                {sessions.isPending ? (
                  width >= 768 ? (
                    <View className="w-full gap-3 py-3">
                      <Skeleton className="h-6 w-24 rounded-md" />
                      <Skeleton className="h-3 w-full rounded-full" />
                    </View>
                  ) : (
                    <GoalRingSkeleton />
                  )
                ) : sessions.isError ? (
                  <Button size="sm" variant="ghost" onPress={() => void sessions.refetch()}>
                    <Button.Label>{t("common.retry")}</Button.Label>
                  </Button>
                ) : (
                  <TodayPlayDuration durationMs={today?.ms ?? 0} tablet={width >= 768} />
                )}
              </View>
            ) : (
              <View className="w-full flex-1">
                <AnnualGoal
                  year={year}
                  finished={yearlyFinished(completed.data ?? [], year)}
                  status={
                    isSessionLoading
                      ? "loading"
                      : !canRead
                        ? "guest"
                        : completed.isError
                          ? "error"
                          : completed.isPending
                            ? "loading"
                            : "ready"
                  }
                  tablet={width >= 768}
                  onRetry={() => void completed.refetch()}
                />
              </View>
            )}
          </Card.Body>
        </Card>
      ))}
    </View>
  );
}
