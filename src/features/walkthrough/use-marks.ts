/**
 * 攻略标记的 React 绑定。
 *
 * 标记的读写都很快（本地 AsyncStorage），但用 React Query 托管有两个实在的好处：
 *   - 切换详情页签时组件会卸载重挂，从查询缓存恢复**不用等一次异步读取**，不会闪一下空进度
 *   - 状态与攻略正文在同一个 QueryClient 里，「清缓存」能一次管到
 *
 * 打标记时用 `setQueryData` 先改内存再落盘（乐观更新）—— 点一下必须立刻有反应，
 * 等 AsyncStorage 写完会有可感知的延迟。
 *
 * ## ⚠️ 这里的回调必须 `useCallback` 稳定化，否则整份优化清单失效
 *
 * 单个结局最多 500+ 步。步骤行是 `memo` 的，只有 `onToggle` 引用不变时
 * 「打一个勾只重渲染一行」才成立。而回调如果直接闭包捕获 `marks`，
 * `marks` 一变引用就变 → 所有行全部重渲染（等于没加 `memo`）。
 *
 * 所以回调里**不捕获 `marks`**，改用 `client.getQueryData(key)` 在**调用时**
 * 读最新值：既拿到最新状态，又不把 `marks` 变成依赖。
 * （不用 ref 中转：`react/refs` 规则不允许在渲染期写 ref.current。）
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { queryKeys } from "@/lib/query/keys";

import { pinWalkthrough } from "./cache";
import {
  clearMarks,
  isAchieved,
  isDone,
  isStarred,
  markStepsDone,
  readMarks,
  toggleEnding,
  toggleStepMark,
  writeMarks,
  type MarkField,
  type WalkthroughMarks,
} from "./marks";

/** 传给各组件的标记接口（组件因此不必知道存储怎么实现） */
export interface WalkthroughMarkApi {
  isDone: (stepId: string) => boolean;
  isStarred: (stepId: string) => boolean;
  isAchieved: (endingId: string) => boolean;
  toggleStep: (stepId: string, field: MarkField) => void;
  markStepsDone: (stepIds: readonly string[]) => void;
  toggleEnding: (endingId: string) => void;
  clear: () => void;
}

export interface UseWalkthroughMarksResult extends WalkthroughMarkApi {
  marks: WalkthroughMarks;
}

export function useWalkthroughMarks(vid: string): UseWalkthroughMarksResult {
  const client = useQueryClient();
  /*
   * ⚠️ key 必须 memo。`queryKeys.walkthrough.marks(vid)` 每次调用都返回**新数组**，
   * 直接当依赖的话每次渲染引用都变 → `apply` / `mark` / `toggleStep` 全被重建
   * → 步骤行的 `memo` 全部失效（几百行照样重渲染）。
   * React Query 自己按结构比较 key，所以 memo 不影响它的缓存命中。
   */
  const key = useMemo(() => queryKeys.walkthrough.marks(vid), [vid]);

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(vid),
    // 标记是纯本地数据，重试没有任何意义
    retry: false,
    staleTime: Infinity,
    queryFn: () => readMarks(vid),
  });

  // 标记还没读出来时的空壳；读取是一次本地 IO，实际很快
  const empty = useMemo<WalkthroughMarks>(
    () => ({ vid, endings: [], steps: {}, updatedAt: 0 }),
    [vid]
  );
  const current = query.data ?? empty;

  /**
   * 先改内存、再落盘。
   *
   * ⚠️ 写盘失败**不能**让界面回滚 —— 内存里已经是新状态，回滚反而会让
   * 「我明明点了」和显示对不上。失败就留到下次打开从存储读到旧值，可接受。
   */
  const apply = useCallback(
    (next: WalkthroughMarks) => {
      client.setQueryData<WalkthroughMarks>(key, next);
      void writeMarks(next);
    },
    [client, key]
  );

  // 打第一个标记 = 用户要反复回来看这篇 → 钉住，别被 LRU 淘汰。
  // `pinWalkthrough` 内部有「本进程已钉住」短路，不会每次都去读整篇正文。
  const mark = useCallback(
    (recipe: (marks: WalkthroughMarks) => WalkthroughMarks) => {
      const prev = client.getQueryData<WalkthroughMarks>(key);
      if (!prev) return;
      void pinWalkthrough(vid);
      apply(recipe(prev));
    },
    [apply, client, key, vid]
  );

  const toggleStep = useCallback(
    (stepId: string, field: MarkField) => mark((m) => toggleStepMark(m, stepId, field)),
    [mark]
  );

  const markGroup = useCallback(
    (stepIds: readonly string[]) => mark((m) => markStepsDone(m, stepIds)),
    [mark]
  );

  const toggleEnd = useCallback(
    (endingId: string) => mark((m) => toggleEnding(m, endingId)),
    [mark]
  );

  const clear = useCallback(() => {
    const prev = client.getQueryData<WalkthroughMarks>(key);
    if (!prev) return;
    client.setQueryData<WalkthroughMarks>(key, { ...prev, endings: [], steps: {} });
    void clearMarks(vid);
  }, [client, key, vid]);

  const isDoneIn = useCallback((stepId: string) => isDone(current, stepId), [current]);
  const isStarredIn = useCallback((stepId: string) => isStarred(current, stepId), [current]);
  const isAchievedIn = useCallback((endingId: string) => isAchieved(current, endingId), [current]);

  // 整体也 memo 住：`EndingCard` / `RouteCard` 只吃这个对象，
  // 引用稳定它们就不会因为某一行打勾而跟着重渲染
  return useMemo(
    () => ({
      marks: current,
      isDone: isDoneIn,
      isStarred: isStarredIn,
      isAchieved: isAchievedIn,
      toggleStep,
      markStepsDone: markGroup,
      toggleEnding: toggleEnd,
      clear,
    }),
    [current, isDoneIn, isStarredIn, isAchievedIn, toggleStep, markGroup, toggleEnd, clear]
  );
}
