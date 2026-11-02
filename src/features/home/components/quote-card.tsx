import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Card, Skeleton } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";
import { Muted, Paragraph } from "@/components/typo";
import { useCopyProps } from "@/hooks/use-copy";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";
import { STALE_TIME } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { vnCopyText } from "@/utils/copy-text";
import { queryRandomQuote } from "@/lib/api/endpoints/vn";
import { readDailyQuote, writeDailyQuote } from "@/lib/storage/daily-quote";
import { todayIso } from "@/utils/format";

export function QuoteCard(): JSX.Element | null {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useTranslucentSurface();
  const dateKey = todayIso();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.quote.ofTheDay(dateKey),
    /*
     * 「每日」的语义：当天第一次打开抽一条，之后整天不变。
     * 内存里由 React Query 缓存（key 带日期），落盘由 `dailyQuote` 负责 ——
     * 杀进程重开也是同一条，跨天 key 变化自动换新。
     */
    queryFn: async ({ signal }) => {
      const cached = await readDailyQuote(dateKey);
      if (cached) return cached;
      const fresh = await queryRandomQuote(signal);
      const quote = fresh.results[0];
      if (quote) await writeDailyQuote(quote, dateKey);
      return quote;
    },
    staleTime: STALE_TIME.quote,
  });

  /*
   * 语录正文是普通文字：长按走系统选区（全局行为，见 `components/typo`），
   * 想连出处一起复制就长按下面那行作品名（它是 Pressable，长按=整条复制）。
   * hook 必须排在骨架屏 / 空态的提前 return 之前。
   */
  const copyVn = useCopyProps(vnCopyText({ id: data?.vn?.id ?? "", title: data?.vn?.title }), {
    preview: data?.vn?.title,
  });

  // 骨架屏：以前这里直接返回一个 h-2 的空白，首屏会「什么都没有 → 突然出现一张卡」
  if (isLoading) {
    return (
      <Card className="mx-4 my-3" style={surface}>
        <Card.Body className="gap-2.5">
          <Skeleton variant="pulse" className="h-4 w-full rounded-md" />
          <Skeleton variant="pulse" className="h-4 w-3/5 rounded-md" />
          <Skeleton variant="pulse" className="h-3 w-1/3 rounded-md" />
        </Card.Body>
      </Card>
    );
  }

  if (!data?.quote) return null;

  return (
    <Card className="mx-4 my-3" style={surface}>
      <Card.Body>
        <Paragraph>「{data.quote}」</Paragraph>
        {data.vn ? (
          <Pressable
            onPress={() => router.push(`/vn/${data.vn?.id}`)}
            onLongPress={copyVn.onLongPress}
            delayLongPress={copyVn.delayLongPress}
            className="mt-2 self-start active:opacity-60"
            accessibilityHint={t("home.quoteCopyHint")}
          >
            <Muted type="body-sm" className="text-link">
              — {data.vn.title}
            </Muted>
          </Pressable>
        ) : null}
      </Card.Body>
    </Card>
  );
}
