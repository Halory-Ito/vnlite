import { Fragment, useCallback, useEffect, useState, type JSX } from "react";
import { Button, useToast } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";

import { ClearCategoriesDialog } from "@/components/clear-categories-dialog";
import { Divider } from "@/components/separator";
import { Body, H3, Muted } from "@/components/typo";
import { clearWalkthroughCache, getWalkthroughCacheStats } from "@/features/walkthrough/lib/cache";
import {
  clearImageCacheCategory,
  getImageCacheStats,
  IMAGE_CACHE_CATEGORIES,
  type ImageCacheCategory,
} from "@/features/settings/lib/image-cache";
import { useTranslation } from "@/hooks/use-translation";
import {
  clearQueryCacheCategory,
  getQueryCacheStats,
  type CacheCategory,
} from "@/lib/query/client";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";

type Row = {
  id: CacheCategory | "walkthrough";
  bytes: number;
};
const CATEGORY_COLORS = [
  "#2D9CDB",
  "#27AE60",
  "#F2994A",
  "#9B51E0",
  "#EB5757",
  "#56CCF2",
  "#219653",
  "#BB6BD9",
  "#F2C94C",
  "#828282",
];
const QUERY_CATEGORIES: CacheCategory[] = [
  "vn",
  "character",
  "producer",
  "staff",
  "screenshots",
  "taxonomy",
  "community",
  "ranking",
  "other",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export default function CacheScreen(): JSX.Element {
  const { t } = useTranslation();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<(CacheCategory | "walkthrough")[]>([]);
  const [isClearOpen, setIsClearOpen] = useState(false);

  const refresh = useCallback(async () => {
    const queries = getQueryCacheStats();
    const [walkthrough, images] = await Promise.all([
      getWalkthroughCacheStats(),
      getImageCacheStats(),
    ]);
    setRows([
      ...QUERY_CATEGORIES.map((id) => ({
        id,
        bytes: queries[id].bytes + (isImageCacheCategory(id) ? images[id] : 0),
      })),
      { id: "walkthrough", bytes: walkthrough.bytes },
    ]);
  }, []);
  useEffect(() => {
    const task = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(task);
  }, [refresh]);

  const clearSelected = async () => {
    await Promise.all(
      selected.map((id) =>
        id === "walkthrough"
          ? clearWalkthroughCache()
          : Promise.all([
              clearQueryCacheCategory(id),
              ...(isImageCacheCategory(id) ? [clearImageCacheCategory(id)] : []),
            ])
      )
    );
    setSelected([]);
    setIsClearOpen(false);
    await refresh();
    toast.show(t("me.cacheCleared"));
  };
  const options = rows.map((row) => ({ value: row.id, label: t(`cache.category.${row.id}`) }));
  const totalBytes = rows.reduce((sum, row) => sum + (row.bytes ?? 0), 0);
  const chartRows = rows.filter((row) => row.bytes !== null && row.bytes > 0);
  const chartTotal = chartRows.reduce((sum, row) => sum + (row.bytes ?? 0), 0);

  return (
    <SettingsShell
      title={t("cache.title")}
      footer={
        <View
          className="border-t border-foreground/10 px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button onPress={() => setIsClearOpen(true)}>
            <Button.Label>{t("cache.clearSelected")}</Button.Label>
          </Button>
        </View>
      }
    >
      <SettingsSection title={t("cache.contentTitle")}>
        <View className="flex-row items-baseline gap-2">
          <H3>{formatMegabytes(totalBytes)}</H3>
          <Body>MB</Body>
        </View>
        <View
          className="mt-3 h-3 flex-row overflow-hidden rounded-full"
          accessibilityLabel={t("cache.chartLabel")}
        >
          {chartRows.map((row) => (
            <View
              key={row.id}
              style={{
                flex: Math.max(0.01, (row.bytes ?? 0) / chartTotal),
                backgroundColor: CATEGORY_COLORS[rows.indexOf(row) % CATEGORY_COLORS.length],
              }}
            />
          ))}
        </View>
        <View className="mt-2">
          {rows.map((row, index) => (
            <Fragment key={row.id}>
              {index > 0 ? <Divider /> : null}
              <View className="min-h-12 flex-row items-center gap-3 py-2">
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <Muted type="body-sm" className="flex-1">
                  {t(`cache.category.${row.id}`)}
                </Muted>
                <Muted type="body-sm">{formatBytes(row.bytes)}</Muted>
              </View>
            </Fragment>
          ))}
        </View>
      </SettingsSection>
      <ClearCategoriesDialog
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        title={t("cache.confirmTitle")}
        description={t("cache.confirmDescription")}
        options={options}
        selected={selected}
        onChange={setSelected}
        onConfirm={() => void clearSelected()}
      />
    </SettingsShell>
  );
}

function isImageCacheCategory(category: string): category is ImageCacheCategory {
  return (IMAGE_CACHE_CATEGORIES as readonly string[]).includes(category);
}
