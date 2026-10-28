/**
 * 日历下方的作品列表。
 *
 * 只显示**用户点中的那一天**；没选日期时什么都不铺，也不放提示。
 * 用 `FlashList`：单日作品一般不多，但列表本身跟整月数据共用缓存，
 * 换天 / 换月时数据切换要跟得上。
 */

import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import type { JSX, Ref } from "react";
import { useCallback } from "react";
import { View } from "react-native";

import { ErrorState, LoadingState } from "@/components/screen-state";
import { Muted } from "@/components/typo";
import { useTranslation } from "@/hooks/use-translation";
import type { VnSummary } from "@/lib/api/types";
import { formatMonthDay } from "@/utils/format";

import { CalendarRow } from "@/features/calendar/components/calendar-row";

export interface CalendarMonthListProps {
  items: VnSummary[];
  /** `null` = 还没选日期 */
  activeDay: string | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  listRef: Ref<FlashListRef<VnSummary>>;
}

export function CalendarMonthList({
  items,
  activeDay,
  isLoading,
  isError,
  error,
  onRetry,
  listRef,
}: CalendarMonthListProps): JSX.Element {
  const { t } = useTranslation();

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<VnSummary>) => <CalendarRow vn={item} />,
    []
  );

  return (
    <FlashList<VnSummary>
      /* flex-1 不可省：FlashList 默认按内容高度撑开，会盖住下方内容 */
      style={{ flex: 1 }}
      ref={listRef as never}
      data={items}
      renderItem={renderRow}
      keyExtractor={(vn) => vn.id}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View>
          {activeDay ? (
            <Muted type="body-xs" className="px-4 pb-1 pt-3 font-semibold">
              {formatMonthDay(activeDay)}
            </Muted>
          ) : null}
          {isError ? <ErrorState error={error} onRetry={onRetry} /> : null}
        </View>
      }
      ListEmptyComponent={
        !activeDay ? null : isError ? null : isLoading ? (
          <LoadingState label={t("calendar.loading")} className="py-8" />
        ) : (
          <Muted type="body-sm" className="px-4 py-6">
            {t("calendar.dayEmpty")}
          </Muted>
        )
      }
    />
  );
}
