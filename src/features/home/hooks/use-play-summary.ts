import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useAllPlaySessions } from "@/features/play-records/hooks";
import { usePermission, useSession } from "@/hooks/use-session";
import { queryList } from "@/lib/api/endpoints/ulist";
import type { UListItem } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";

export function useHomePlaySummary(includeRecords = true, includeCompleted = true) {
  const sessions = useAllPlaySessions(includeRecords);
  const session = useSession();
  const canRead = usePermission("listread");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const { refetch } = sessions;
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      if (includeRecords) void refetch();
    }, [refetch, includeRecords])
  );
  const completed = useQuery({
    queryKey: [
      ...queryKeys.ulist.all,
      "homeCompleted",
      session.status === "authenticated" ? session.account.userId : null,
    ],
    enabled: canRead && includeCompleted,
    queryFn: async ({ signal }) => {
      const items: UListItem[] = [];
      for (let page = 1; ; page += 1) {
        const response = await queryList({
          fields: ["id", "finished", "labels.id"],
          filters: ["label", "=", 2],
          results: 100,
          page,
          signal,
        });
        items.push(...response.results);
        if (!response.more) return items;
      }
    },
  });
  return { sessions, completed, canRead, now, isSessionLoading: session.status === "loading" };
}
