/**
 * 一份同步配置的卡片。
 *
 * 布局：
 *   标题行    配置名称（点一下 = 设为当前）+ 「当前」标签 + 编辑按钮（icon only）
 *   状态行    只在同步中 / 失败时出现（失败显示原因）
 *   底部行    左边上次同步时间，右边「上传 / 下载」两个 **icon only** 按钮
 *
 * 服务类型与服务器地址不上卡片 —— 每份配置都有自己起过的名字，够区分了。
 */

import { Button, Card, Chip, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Muted } from "@/components/typo";
import { useTranslucentSurface } from "@/hooks/use-translucent-surface";
import { useTranslation } from "@/hooks/use-translation";
import { formatDateTime } from "@/utils/format";

import type { SyncConfig } from "../lib/configs/types";

export interface SyncConfigCardProps {
  config: SyncConfig;
  /** 是否是当前使用的配置 */
  isActive: boolean;
  /** 有同步任务在跑（按钮一律禁用） */
  busy: boolean;
  /** 就是这一份在同步 */
  syncing: boolean;
  /** 这次同步的错误 */
  error: string | null;
  /** 设成当前配置 */
  onSelect: () => void;
  /** 编辑这份配置 */
  onEdit: () => void;
  /** 上传备份 */
  onUpload: () => void;
  /** 下载备份 */
  onDownload: () => void;
}

export function SyncConfigCard({
  config,
  isActive,
  busy,
  syncing,
  error,
  onSelect,
  onEdit,
  onUpload,
  onDownload,
}: SyncConfigCardProps): JSX.Element {
  const { t } = useTranslation();
  const muted = useThemeColor("muted");
  const accentForeground = useThemeColor("accent-foreground");
  const accentSoftForeground = useThemeColor("accent-soft-foreground");
  const surface = useTranslucentSurface();

  const status = syncing
    ? t("sync.statusSyncing")
    : error
      ? t("sync.statusFailedDetail", { error })
      : null;

  return (
    <Card style={surface}>
      <Card.Header className="flex-row items-center gap-3">
        <Pressable
          className="flex-1"
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={t("sync.setCurrent")}
        >
          <Card.Title numberOfLines={1}>{config.name}</Card.Title>
        </Pressable>

        {/* 标签和编辑按钮靠右一组：标题再长也不会把它们挤散 */}
        <View className="flex-row items-center gap-2">
          {isActive ? (
            <Chip size="sm" variant="soft" color="accent" className="shrink-0">
              <Chip.Label numberOfLines={1}>{t("sync.currentBadge")}</Chip.Label>
            </Chip>
          ) : null}

          <Pressable
            onPress={onEdit}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel={t("sync.editConfig")}
          >
            <Icon name="pencil" size={16} color={muted} />
          </Pressable>
        </View>
      </Card.Header>

      {status ? (
        <Card.Body>
          <Muted
            type="body-xs"
            className={error && !syncing ? "text-danger-soft-foreground" : undefined}
          >
            {status}
          </Muted>
        </Card.Body>
      ) : null}

      <Card.Footer className="flex-row items-center justify-between gap-3">
        <Muted type="body-xs" className="flex-1" numberOfLines={1}>
          {config.lastSyncAt
            ? t("sync.lastSyncAt", { time: formatDateTime(config.lastSyncAt) })
            : t("sync.never")}
        </Muted>

        <View className="flex-row gap-2">
          <Button
            size="sm"
            isIconOnly
            onPress={onUpload}
            isDisabled={busy}
            accessibilityLabel={t("sync.upload")}
          >
            <Icon name="arrowUpFromLine" size={16} color={accentForeground} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            isIconOnly
            onPress={onDownload}
            isDisabled={busy}
            accessibilityLabel={t("sync.download")}
          >
            <Icon name="arrowDownToLine" size={16} color={accentSoftForeground} />
          </Button>
        </View>
      </Card.Footer>
    </Card>
  );
}
