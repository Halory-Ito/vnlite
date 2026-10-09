/**
 * 游玩记录的数据层（React Query + 本地 SQLite）。
 *
 * 记录由计时器「结束」时写入（见 `features/game-timer/actions#finishGameTimer`），
 * 写入后失效 `playRecords.all`，详情页的「记录」页签自动刷新。
 */

import { useQuery } from "@tanstack/react-query";

import { getPlaySessions } from "@/lib/db/dao/play-session";
import { queryKeys } from "@/lib/query/keys";

/** 某作品的全部游玩记录（按开始时间倒序） */
export function usePlaySessions(vnId: string) {
  return useQuery({
    queryKey: queryKeys.playRecords.list(vnId),
    queryFn: () => getPlaySessions(vnId),
    // 本地库读取即时完成，不必缓存
    staleTime: 0,
  });
}
