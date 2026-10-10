/**
 * 游玩记录的数据层（React Query + 本地 SQLite）。
 *
 * 记录由计时器「结束」时写入（见 `features/game-timer/actions#finishGameTimer`）；
 * 「记录」列表左滑可**设置**（改起止时间）与**删除**单条。写操作成功后失效
 * `playRecords.all`，页签自动刷新。
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  deletePlaySession,
  getAllPlaySessions,
  getPlaySessions,
  updatePlaySession,
  type PlaySessionTiming,
} from "@/lib/db/dao/play-session";
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

/** 全部作品的游玩记录（记录统计页聚合用） */
export function useAllPlaySessions() {
  return useQuery({
    queryKey: queryKeys.playRecords.allSessions(),
    queryFn: getAllPlaySessions,
    // 本地库读取即时完成，不必缓存
    staleTime: 0,
  });
}

/** 记录列表写操作成功后的统一失效 */
function useInvalidatePlayRecords(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ queryKey: queryKeys.playRecords.all });
  }, [client]);
}

/** 修改单条记录的起止时间与时长 */
export function useUpdatePlaySession() {
  const invalidate = useInvalidatePlayRecords();
  return useMutation({
    mutationFn: ({ id, timing }: { id: number; timing: PlaySessionTiming }) =>
      updatePlaySession(id, timing),
    onSuccess: invalidate,
  });
}

/** 删除单条记录 */
export function useDeletePlaySession() {
  const invalidate = useInvalidatePlayRecords();
  return useMutation({
    mutationFn: (id: number) => deletePlaySession(id),
    onSuccess: invalidate,
  });
}
