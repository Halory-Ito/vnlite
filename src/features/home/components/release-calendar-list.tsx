import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Skeleton } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Muted } from "@/components/typo";
import { VnListItem } from "@/features/vn/components/vn-list-item";
import { useTranslation } from "@/hooks/use-translation";
import { queryVns } from "@/lib/api/endpoints/vn";
import { compileVnFilters } from "@/lib/api/filters";
import { STALE_TIME } from "@/lib/query/client";
import { ReleaseReminderButton } from "./release-reminder-button";

interface ListProps {
  date: string;
  compact: boolean;
}

export function ReleaseCalendarList({ date, compact }: ListProps) {
  const [loadingRows, setLoadingRows] = useState(1);
  return (
    <ReleaseCalendarDayList
      key={date}
      date={date}
      compact={compact}
      loadingRows={loadingRows}
      onRowsChange={setLoadingRows}
    />
  );
}

function ReleaseCalendarDayList({
  date,
  compact,
  loadingRows,
  onRowsChange,
}: ListProps & {
  loadingRows: number;
  onRowsChange: (rows: number) => void;
}) {
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
  const items = query.data?.results;
  const invalidResponse = !Array.isArray(items);
  useEffect(() => {
    if (items) onRowsChange(Math.max(1, items.length));
  }, [items, onRowsChange]);
  const showPagination = page > 1 || query.data?.more;
  return (
    <View className="gap-2">
      <View className={compact ? "gap-2" : "min-h-[542px] gap-2"}>
        {query.isPending ? (
          <View className="gap-2">
            {Array.from({ length: compact ? loadingRows : 5 }, (_, index) => (
              <View key={index} className="flex-row items-center gap-3 px-4 py-2.5">
                <Skeleton className="h-[82px] w-[62px] rounded-md" />
                <View className="flex-1 gap-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </View>
              </View>
            ))}
          </View>
        ) : query.isError || invalidResponse ? (
          <View className="items-center gap-2 py-4">
            <Muted>{t("common.errorTitle")}</Muted>
            <Button size="sm" variant="secondary" onPress={() => void query.refetch()}>
              <Button.Label>{t("common.retry")}</Button.Label>
            </Button>
          </View>
        ) : items.length === 0 ? (
          <Muted type="body-sm" className="py-6 text-center">
            {t("home.calendarEmpty")}
          </Muted>
        ) : (
          items.map((vn) => (
            <VnListItem
              key={vn.id}
              vn={vn}
              onPress={(id) => router.push(`/vn/${id}`)}
              fields={["rating"]}
              trailing={<ReleaseReminderButton vn={vn} date={date} />}
            />
          ))
        )}
      </View>
      {!compact || showPagination ? (
        <View className={compact ? "" : "min-h-9"}>
          {showPagination ? (
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
                isDisabled={
                  !query.data?.more || query.isPending || query.isError || invalidResponse
                }
                onPress={() => setPage((value) => value + 1)}
              >
                <Button.Label>{t("home.calendarNextPage")}</Button.Label>
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
