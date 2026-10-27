/**
 * 游戏计时的共享「结束」动作。
 *
 * 计时器可能从多处结束（App 内浮层、通知栏按钮），统一走这里：
 * 停计时 → 落一条游玩记录 → 失效记录查询。只依赖 lib，不依赖 React，
 * 因此通知事件（可能在 headless 上下文）也能调用。
 */

import { insertPlaySession } from "@/lib/db/dao/play-session";
import { queryClient } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";

import { stopGameTimer } from "./store";

/** 结束当前计时并落记录；本就空闲时什么都不做 */
export function finishGameTimer(): void {
  const finished = stopGameTimer();
  if (!finished) return;
  void insertPlaySession(finished).then(() =>
    queryClient.invalidateQueries({ queryKey: queryKeys.playRecords.all })
  );
}
