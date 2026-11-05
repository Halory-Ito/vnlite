/**
 * English · sync module (multiple sync configs + WebDAV backup sync).
 *
 * 接入点：`features/sync/*`（"Me → Sync" screen）。
 */
import type { CatalogOf } from "../catalog-types";
import { zhSync } from "../zh/sync";

export const enSync: CatalogOf<typeof zhSync> = {
  sync: {
    title: "Sync",
    urlLabel: "Server URL",
    urlPlaceholder: "https://dav.example.com/dav/files/user",
    usernameLabel: "Username",
    passwordLabel: "Password",
    save: "Save",
    invalidUrl: "The server URL must start with http:// or https://",

    /* ---- 配置列表 ---- */
    configsSection: "Sync configs",
    noConfigs: "No sync config yet, add one below",
    addConfig: "Add config",
    newConfigTitle: "New sync config",
    editConfigTitle: "Edit sync config",
    configNameLabel: "Config name",
    configNamePlaceholder: "e.g. My Nutstore",
    nameRequired: "Give this config a name",
    serviceLabel: "Service",
    currentBadge: "Current",
    setCurrent: "Set as the current config",
    editConfig: "Edit config",
    deleteConfig: "Delete config",
    deleteConfigTitle: "Delete this config?",
    deleteConfigBody:
      "This removes the sign-in info and sync history of this config. Backup files on the server are kept.",
    providerNotReady: "This service is not supported yet",
    comingSoon: "Coming soon",
    configMissing: "This config no longer exists",

    /* ---- 供应商 ---- */
    provider: {
      webdav: "WebDAV",
      baidunetdisk: "Baidu Netdisk",
      quark: "Quark Drive",
    },
    quark: {
      storageFailed:
        "Could not securely save authorization or upload state. Check device secure storage and retry.",
      notConnected: "Reconnect Quark Drive",
      authFailed: "Quark authorization failed. Please try again.",
      expired: "Authorization expired. Please try again.",
      cancelled: "Authorization cancelled",
      apiError: "Quark Drive request failed (code %{code})",
      invalidResponse: "Quark Drive returned an incomplete response",
      invalidDirectory: "Enter a valid folder name without path separators",
      directory: "Sync folder",
      authorize: "Authorize with Quark",
      reconnect: "Authorize again",
      openAuthorization: "Open Quark authorization",
      qrLabel: "Scan with the Quark app to authorize",
      connected: "Connected to Quark Drive",
      openFailed:
        "Could not open Quark. Check that Quark is installed, or scan the QR code with Quark.",
      integrityFailed: "Cloud file verification failed. Sync again.",
      pending: "The previous upload still needs recovery. Please retry shortly.",
      conflict: "Cloud files changed. Please retry.",
      uploadFailed: "Quark file upload failed",
    },
    baidu: {
      notConnected: "Connect Baidu Netdisk first",
      configMissing: "Baidu AppKey or SecretKey is not configured",
      authFailed: "Authorization failed. Request a new code.",
      codeRequired: "Enter the authorization code",
      apiError: "Baidu Netdisk request failed (code %{code})",
      invalidResponse: "Baidu Netdisk returned an incomplete response",
      invalidPath: "The directory must be under /apps/app-name",
      directory: "App directory",
      code: "Authorization code",
      connect: "Confirm authorization",
      connected: "Connected to Baidu Netdisk",
      reconnect: "Authorize again",
      openAuthorization: "Open Baidu authorization",
    },

    /* ---- 同步状态 ---- */
    statusSyncing: "Syncing…",
    statusFailedDetail: "Sync failed: %{error}",
    lastSyncAt: "Last sync %{time}",
    never: "Never synced",

    upload: "Upload backup",
    download: "Download backup",
    uploaded: "Backup uploaded",
    restored: "Data restored",
    remoteMissing: "No backup on the server yet",

    uploadConfirmTitle: "Replace cloud backup?",
    uploadConfirmBody:
      "This replaces the existing cloud backup with data from this device. It cannot be undone.",
    uploadConfirm: "Replace and upload",

    restoreTitle: "Restore backup",
    restoreBody:
      "This replaces your history, favorites, play records, walkthrough marks and settings with the ones on the server. It cannot be undone.",
    restoreConfirm: "Replace and restore",
    backupTime: "Backed up at %{time}",
    itemHistory: "%{count} history",
    itemFavorite: "%{count} favorites",
    itemPlaySession: "%{count} play records",
    itemMarks: "%{count} walkthroughs marked",
    itemBackground: "Custom background image",

    /* ---- 网络错误 ---- */
    unauthorized: "Wrong username or password",
    forbidden: "No permission for this folder",
    notFound: "The file is not on the server",
    serverError: "Server error (HTTP %{status})",
    requestFailed: "Request failed (HTTP %{status})",
    networkError: "Could not reach the server",
    timeout: "Request timed out",
    invalidBackup: "This is not a vnlite backup",
  },
};
