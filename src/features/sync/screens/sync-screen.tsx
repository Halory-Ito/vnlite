/**
 * 「同步」页：把本地数据打包上传到 WebDAV，或从服务器下载恢复。
 *
 * ## 数据流向
 *
 *   上传：本地库 + 攻略标记 + 应用偏好 → JSON → `PUT {目录}/vnlite-backup.json`
 *   下载：`GET {目录}/vnlite-backup.json` → JSON → **先给用户看** → 确认后覆盖本地
 *
 * 缓存（攻略正文 / 索引）与登录凭据**不参与同步**（见 `../backup`）。
 */

import { Button, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { TranslucentPanel } from "@/components/translucent-panel";
import { Muted } from "@/components/typo";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey, TranslationParams } from "@/lib/i18n/translate";
import { formatBytes } from "@/utils/format";

import { SyncServerForm } from "../components/sync-server-form";
import type { BackupPayload } from "../backup";
import { useSyncBackup } from "../use-sync-backup";
import { useSyncServer } from "../use-sync-server";
import { normalizeServerUrl, type WebDavConfig } from "../webdav";

/** 两位补零 */
const pad = (n: number): string => String(n).padStart(2, "0");

export default function SyncScreen(): JSX.Element {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    loading,
    url,
    username,
    password,
    setUrl,
    setUsername,
    setPassword,
    save,
    lastSyncAt,
    refreshLastSync,
  } = useSyncServer();
  const backup = useSyncBackup();
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const busy =
    backup.phase === "packing" ||
    backup.phase === "uploading" ||
    backup.phase === "downloading" ||
    backup.phase === "restoring";

  /**
   * 存一次配置；地址不合法返回 false。
   *
   * ⚠️ 这里刻意**不用 `useCallback`**：依赖里那个 `save` 来自自定义 hook
   * （它本身就是 `useCallback`），oxlint 的 `react/memo-dependencies` 会把
   * 这种依赖判成「多余的 memoization 依赖」而报警。
   * 这些函数只是 `onPress` 处理器，由 React Compiler 负责记忆化，套一层
   * `useCallback` 反而碍事。
   */
  const saveConfig = async (): Promise<boolean> => {
    setSaving(true);
    setUrlError(null);
    try {
      const ok = await save();
      if (!ok) {
        setUrlError(t("sync.invalidUrl"));
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const onSave = (): void => {
    void saveConfig().then((ok) => {
      if (ok) toast.show(t("sync.saved"));
    });
  };

  /**
   * 上传 / 下载：先存一次配置（免得用户填完还得再点一次「保存」），
   * 再用**当前表单值**发请求。
   */
  const withConfig = async (action: (value: WebDavConfig) => Promise<void>): Promise<void> => {
    const normalized = normalizeServerUrl(url);
    if (!normalized) {
      setUrlError(t("sync.invalidUrl"));
      return;
    }
    const saved = await saveConfig();
    if (!saved) return;
    await action({ url: normalized, username: username.trim(), password });
  };

  const onUpload = (): void => {
    void withConfig((value) => backup.upload(value));
  };

  const onDownload = (): void => {
    void withConfig((value) => backup.download(value));
  };

  const pending = backup.pending;

  return (
    <SettingsShell title={t("sync.title")}>
      <SettingsSection title={t("sync.serverSection")}>
        <TranslucentPanel>
          <SyncServerForm
            url={url}
            username={username}
            password={password}
            onChangeUrl={setUrl}
            onChangeUsername={setUsername}
            onChangePassword={setPassword}
            onSave={onSave}
            saving={saving}
            error={urlError}
          />
        </TranslucentPanel>
      </SettingsSection>

      <SettingsSection title={t("sync.backupSection")}>
        <TranslucentPanel>
          <View className="gap-1">
            <Muted type="body-sm">
              {t("sync.lastSync")}：{lastSyncAt ? formatTime(lastSyncAt) : t("sync.never")}
            </Muted>
            <Muted type="body-sm">
              {t("sync.remoteFile")}：
              {backup.remote
                ? `${formatBytes(backup.remote.size) ?? "—"} · ${
                    backup.remote.modifiedAt ? formatTime(backup.remote.modifiedAt) : "—"
                  }`
                : t("sync.remoteMissing")}
            </Muted>
          </View>

          {backup.error ? (
            <Muted type="body-xs" className="text-danger-soft-foreground">
              {backup.error}
            </Muted>
          ) : null}

          <View className="mt-1 flex-row gap-3">
            <Button size="sm" className="flex-1" onPress={onUpload} isDisabled={busy || loading}>
              <Button.Label>
                {backup.phase === "packing"
                  ? t("sync.packing")
                  : backup.phase === "uploading"
                    ? t("sync.uploading")
                    : t("sync.upload")}
              </Button.Label>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onPress={onDownload}
              isDisabled={busy || loading}
            >
              <Button.Label>
                {backup.phase === "downloading" ? t("sync.downloading") : t("sync.download")}
              </Button.Label>
            </Button>
          </View>
        </TranslucentPanel>
      </SettingsSection>

      <ConfirmDialog
        isOpen={pending !== null}
        onClose={() => backup.cancelRestore()}
        title={t("sync.restoreTitle")}
        description={pending ? restoreDescription(t, pending) : undefined}
        confirmLabel={t("sync.restoreConfirm")}
        status="warning"
        isPending={backup.phase === "restoring"}
        onConfirm={() => {
          void backup.restore().then(() => refreshLastSync());
        }}
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
  const time = pending.createdAt ? formatTime(pending.createdAt) : "—";
  return `${t("sync.restoreBody")}\n${t("sync.backupTime", { time })}\n${lines.join(" · ")}`;
}

/** unix 毫秒 → `2026-10-21 15:30` */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
