import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { compileVnFilters } from "@/lib/api/filters";
import { STALE_TIME } from "@/lib/query/client";

export function useReleaseCalendarDays(from: string, to: string) {
  return useQuery({
    queryKey: ["vn", "release-calendar-days", from, to],
    queryFn: async ({ signal }) => {
      const dates = new Set<string>();
      let page = 1;
      let more: boolean;
      do {
        signal.throwIfAborted();
        const response = await api.query<{ id: string; released: string }>(
          "/vn",
          {
            filters: compileVnFilters({ releasedFrom: from, releasedTo: to }),
            fields: "id,released",
            sort: "id",
            results: 100,
            page,
          },
          { signal }
        );
        for (const vn of response.results) dates.add(vn.released);
        more = response.more;
        page += 1;
      } while (more);
      return [...dates];
    },
    staleTime: STALE_TIME.vn,
  });
}
