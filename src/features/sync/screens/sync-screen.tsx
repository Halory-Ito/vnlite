/**
 * 「同步」页：多份配置，每份一张卡片，各传各的。
 *
 * ## 数据流向
 *
 *   上传：本地库 + 攻略标记 + 应用偏好 → JSON → `PUT {目录}/vnlite-backup.json`
 *   下载：`GET {目录}/vnlite-backup.json` → JSON → **先给用户看** → 确认后覆盖本地
 *
 * 缓存（攻略正文 / 索引）与登录凭据**不参与同步**（见 `../lib/backup`）。
 *
 * ## 多份配置
 *
 * 每台服务器的认证信息 = 一份配置，各自有独立的备份文件；
 * 点卡片主体切换「当前配置」，点右上角铅笔改配置，底部两个按钮各传各的。
 * 新建 / 编辑在另一个页面（`sync-config-screen`）—— 服务选择器的下拉是
 * Portal 渲染的，放弹窗里会被原生 Modal 挡住。
 */

import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Muted } from "@/components/typo";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { SyncConfigCard } from "@/features/sync/components/sync-config-card";
import { useSyncBackup } from "@/features/sync/hooks/use-sync-backup";
import { useSyncConfigs } from "@/features/sync/hooks/use-sync-configs";
import type { BackupPayload } from "@/features/sync/lib/backup";
import type { SyncConfig } from "@/features/sync/lib/configs/types";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey, TranslationParams } from "@/lib/i18n/translate";
import { formatDateTime } from "@/utils/format";

export default function SyncScreen(): JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const { configs, activeId, loading, setActive, markSynced } = useSyncConfigs();
  const backup = useSyncBackup();
  /**
   * 同一时间只允许一次同步。
   *
   * `useSyncBackup` 只维护一份「进行中」状态 —— 让两张卡片同时上传会互相覆盖
   * 阶段文案与错误归属，所以有任务在跑时**所有**卡片都禁用。
   */
  const syncing = backup.busyConfigId !== null;

  const onUpload = (config: SyncConfig): void => {
    void (async () => {
      const ok = await backup.upload(config);
      if (ok) await markSynced(config.id, Date.now());
    })();
  };

  const onRestore = (): void => {
    const pending = backup.pending;
    if (!pending) return;
    void (async () => {
      const ok = await backup.restore();
      if (ok) await markSynced(pending.config.id, Date.now());
    })();
  };

  return (
    <SettingsShell title={t("sync.title")}>
      <SettingsSection title={t("sync.configsSection")}>
        {loading ? null : configs.length === 0 ? (
          <Muted type="body-sm">{t("sync.noConfigs")}</Muted>
        ) : (
          <View className="gap-3">
            {configs.map((config) => (
              <SyncConfigCard
                key={config.id}
                config={config}
                isActive={config.id === activeId}
                busy={syncing}
                syncing={backup.busyConfigId === config.id}
                error={backup.errorConfigId === config.id ? backup.error : null}
                onSelect={() => void setActive(config.id)}
                onEdit={() =>
                  router.push({ pathname: "/settings/sync-config", params: { id: config.id } })
                }
                onUpload={() => onUpload(config)}
                onDownload={() => void backup.download(config)}
              />
            ))}
          </View>
        )}

        <Button size="sm" onPress={() => router.push("/settings/sync-config")}>
          <Button.Label>{t("sync.addConfig")}</Button.Label>
        </Button>
      </SettingsSection>

      <ConfirmDialog
        isOpen={backup.pending !== null}
        onClose={() => backup.cancelRestore()}
        title={t("sync.restoreTitle")}
        description={backup.pending ? restoreDescription(t, backup.pending.payload) : undefined}
        confirmLabel={t("sync.restoreConfirm")}
        status="warning"
        isPending={backup.phase === "restoring"}
        onConfirm={onRestore}
      />
    </SettingsShell>
  );
}

/** 备份里有什么（恢复前给用户看一眼） */
function restoreDescription(
  t: (key: TranslationKey, params?: TranslationParams) => string,
  pending: BackupPayload
): string {
  const { history, favorite, playSession, marks } = pending.data;
  const lines = [
    t("sync.itemHistory", { count: history.length }),
    t("sync.itemFavorite", { count: favorite.length }),
    t("sync.itemPlaySession", { count: playSession.length }),
    t("sync.itemMarks", { count: Object.keys(marks).length }),
  ];
  const time = pending.createdAt ? formatDateTime(pending.createdAt) : "—";
  return `${t("sync.restoreBody")}\n${t("sync.backupTime", { time })}\n${lines.join(" · ")}`;
}
