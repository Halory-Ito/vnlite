/**
 * VN 详情 · 攻略页签。
 *
 * 入口在 `features/vn/vn-detail-screen`。数据来自独立的静态 JSON 仓库
 * （Kana API 没有攻略端点），所以整条链路是：
 *
 *   索引（判断有没有攻略） → 单篇正文 → 线路 / 结局 / 步骤
 *
 * ## 三种「没有内容」必须分开
 *
 * 页签约定是**始终全部显示**，空内容由页签自己渲染空态。但攻略这里有三层不确定性，
 * 混成一种就会说错话：
 *
 *   1. 索引还在加载 → 「加载中」，**不能**显示「暂无攻略」（一半 VNDB 作品本来就没攻略）
 *   2. 索引已就绪、没有这一条 → 「暂无攻略」（这是真实结论）
 *   3. 正文请求失败 → 错误态 + 重试
 *
 * 所以判断顺序是「先看索引有没有成功」，再看有没有这一条。
 *
 * ## 打开即存
 *
 * 正文一到就落本地（见 `cache#writeBodyCache`），不必用户点保存；标记过的篇目
 * 会被钉住、永不被 LRU 淘汰。标记本身另存（`marks.ts`），所以「清空浏览缓存」
 * 清得掉正文、清不掉进度。
 *
 * ## 剧透保护
 *
 * 取全局偏好 `spoilerShield`：开启后结局名、达成条件、步骤内容全部打码，
 * 点一下才显示。默认关闭 —— 用户是主动点开这个页签来看的。
 * 进度**不受影响**：自己的进度不是剧透。
 */

import type { JSX } from "react";
import { ScrollView } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/components/screen-state";
import { usePreferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/hooks/use-translation";

import { useWalkthrough, useWalkthroughIndex, useWalkthroughMarks } from "../hooks";
import { findEntry, markProgress } from "../select";
import { WalkthroughMeta } from "./walkthrough-meta";
import { WalkthroughRoutes } from "./walkthrough-routes";

export function VnWalkthroughTab({ vnId }: { vnId: string }): JSX.Element {
  const { spoilerShield } = usePreferences();
  const { t } = useTranslation();
  const indexQuery = useWalkthroughIndex();
  const entry = findEntry(indexQuery.data, vnId);
  const walkthroughQuery = useWalkthrough(entry);
  // ⚠️ 标记的 hook 必须在下面的提前 return **之前**调用（rules-of-hooks）
  const marks = useWalkthroughMarks(vnId);

  if (indexQuery.isLoading) {
    return <LoadingState label={t("walkthrough.loadingIndex")} className="py-12" />;
  }
  // 索引没拿到，正文无从谈起 —— 只在「既没数据也没缓存」时才会走到这里
  if (indexQuery.isError && !indexQuery.data) {
    return <ErrorState error={indexQuery.error} onRetry={() => void indexQuery.refetch()} />;
  }

  // 索引已就绪（哪怕是从过期缓存来的）且确实没有这一条 —— 这是真实结论
  if (!entry) {
    return (
      <EmptyState
        title={t("walkthrough.emptyTitle")}
        description={t("walkthrough.emptyDescription")}
      />
    );
  }

  if (walkthroughQuery.isLoading) {
    return <LoadingState label={t("walkthrough.loading")} className="py-12" />;
  }
  if (walkthroughQuery.isError) {
    return (
      <ErrorState error={walkthroughQuery.error} onRetry={() => void walkthroughQuery.refetch()} />
    );
  }

  const walkthrough = walkthroughQuery.data;
  // ⚠️ 有条目但正文解析出 0 条线路：仓库里的文件坏了，如实说明而不是显示空白
  if (!walkthrough || walkthrough.routes.length === 0) {
    return <EmptyState title={t("walkthrough.noContent")} />;
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
      <WalkthroughMeta
        walkthrough={walkthrough}
        progress={markProgress(walkthrough, marks.marks)}
      />
      <WalkthroughRoutes walkthrough={walkthrough} shield={spoilerShield} marks={marks} />
    </ScrollView>
  );
}
