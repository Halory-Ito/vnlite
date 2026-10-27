/**
 * 新建 / 编辑一份同步配置。
 *
 * ## 为什么是独立页面而不是弹窗
 *
 * 弹窗（RN 原生 `Modal`）是**另一个原生窗口**，而服务选择器（HeroUI `Select`）
 * 的下拉列表渲染在全局 Portal 里 —— 那样下拉会被弹窗挡在后面，看不见。
 * 所以这里走普通页面：下拉与页面在同一个窗口。
 *
 * 带 `id` 参数 = 编辑那一份；不带 = 新建。
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { TranslucentPanel } from "@/components/translucent-panel";
import { Muted } from "@/components/typo";
import { SettingsSection, SettingsShell } from "@/features/settings/components/settings-shell";
import { useTranslation } from "@/hooks/use-translation";

import {
  SyncConfigForm,
  type SyncConfigFormValues,
} from "@/features/sync/components/sync-config-form";
import { useSyncConfigs } from "@/features/sync/hooks/use-sync-configs";

export default function SyncConfigScreen(): JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { configs, loading, add, update, remove } = useSyncConfigs();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initial = id ? (configs.find((config) => config.id === id) ?? null) : null;
  const editing = Boolean(id);

  const onSubmit = (values: SyncConfigFormValues): void => {
    setSaving(true);
    void (async () => {
      if (editing && initial) {
        await update({
          ...initial,
          name: values.name,
          provider: values.provider,
          options: values.options,
        });
      } else {
        await add({
          id: values.id,
          name: values.name,
          provider: values.provider,
          options: values.options,
          lastSyncAt: null,
          createdAt: Date.now(),
        });
      }
      setSaving(false);
      router.back();
    })();
  };

  const onDelete = (): void => {
    setConfirmDelete(false);
    if (!initial) return;
    void (async () => {
      await remove(initial.id);
      router.back();
    })();
  };

  // 配置还没从存储里读出来 → 先别渲染表单（否则会闪一下「新建」）
  if (loading) {
    return (
      <SettingsShell title={t("sync.title")}>
        <SettingsSection title={t("sync.configsSection")}>
          <Muted type="body-sm">{t("common.loading")}</Muted>
        </SettingsSection>
      </SettingsShell>
    );
  }

  // 带 id 却找不到（配置被删了 / 从旧链接进来）→ 说清楚，别默默变成「新建」
  if (editing && !initial) {
    return (
      <SettingsShell title={t("sync.editConfigTitle")}>
        <SettingsSection title={t("sync.configsSection")}>
          <Muted type="body-sm">{t("sync.configMissing")}</Muted>
        </SettingsSection>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title={editing ? t("sync.editConfigTitle") : t("sync.newConfigTitle")}>
      <SettingsSection title={t("sync.configsSection")}>
        <TranslucentPanel>
          <SyncConfigForm
            initial={initial}
            saving={saving}
            onSubmit={onSubmit}
            onDelete={editing && initial ? () => setConfirmDelete(true) : null}
            onClose={() => router.back()}
          />
        </TranslucentPanel>
      </SettingsSection>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("sync.deleteConfigTitle")}
        description={t("sync.deleteConfigBody")}
        confirmLabel={t("sync.deleteConfig")}
        status="danger"
        onConfirm={onDelete}
      />
    </SettingsShell>
  );
}
