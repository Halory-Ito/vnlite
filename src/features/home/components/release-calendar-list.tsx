import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Skeleton } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { VnListItem } from "@/features/vn/components/vn-list-item";
import { useTranslation } from "@/hooks/use-translation";
import { queryVns } from "@/lib/api/endpoints/vn";
import { compileVnFilters } from "@/lib/api/filters";
import { STALE_TIME } from "@/lib/query/client";
import { ReleaseReminderButton } from "./release-reminder-button";

export function ReleaseCalendarList({ date }: { date: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["vn", "release-calendar", date, page, 5],
    queryFn: ({ signal }) =>
      queryVns({
        filters: compileVnFilters({ releasedFrom: date, releasedTo: date }),
        sort: "id",
        results: 5,
        page,
        signal,
      }),
    staleTime: STALE_TIME.vn,
  });
  return (
    <View className="gap-2">
      {query.isPending ? (
        <Skeleton className="h-20 rounded-md" />
      ) : query.isError ? (
        <View className="items-center gap-2 py-4">
          <Muted>{t("common.errorTitle")}</Muted>
          <Button size="sm" variant="secondary" onPress={() => void query.refetch()}>
            <Button.Label>{t("common.retry")}</Button.Label>
          </Button>
        </View>
      ) : query.data.results.length === 0 ? (
        <Muted type="body-sm" className="py-6 text-center">
          {t("home.calendarEmpty")}
        </Muted>
      ) : (
        query.data.results.map((vn) => (
          <VnListItem
            key={vn.id}
            vn={vn}
            onPress={(id) => router.push(`/vn/${id}`)}
            fields={["released", "rating"]}
            trailing={<ReleaseReminderButton vn={vn} date={date} />}
          />
        ))
      )}
      {page > 1 || query.data?.more ? (
        <View className="flex-row items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={page === 1 || query.isPending}
            onPress={() => setPage((value) => value - 1)}
          >
            <Button.Label>{t("home.calendarPreviousPage")}</Button.Label>
          </Button>
          <Muted type="body-xs">{t("home.calendarPage", { page })}</Muted>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!query.data?.more || query.isPending}
            onPress={() => setPage((value) => value + 1)}
          >
            <Button.Label>{t("home.calendarNextPage")}</Button.Label>
          </Button>
        </View>
      ) : null}
    </View>
  );
}
