/**
 * English · sync module (multiple sync configs + WebDAV / OneDrive backup sync).
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
      onedrive: "OneDrive",
      googleDrive: "Google Drive",
      quark: "Quark Drive",
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

    restoreTitle: "Restore backup",
    restoreBody:
      "This replaces your history, favorites, play records, walkthrough marks and settings with the ones on the server. It cannot be undone.",
    restoreConfirm: "Replace and restore",
    backupTime: "Backed up at %{time}",
    itemHistory: "%{count} history",
    itemFavorite: "%{count} favorites",
    itemPlaySession: "%{count} play records",
    itemMarks: "%{count} walkthroughs marked",

    /* ---- OneDrive ---- */
    onedrive: {
      clientIdLabel: "Application ID",
      clientIdPlaceholder: "Client ID of your Azure app registration",
      clientIdHint:
        "Create an app registration in Azure, enable public client flows, then paste the application ID here",
      clientIdRequired: "Enter the application ID",
      connect: "Connect OneDrive",
      reconnect: "Switch account",
      disconnect: "Disconnect",
      connecting: "Waiting for approval…",
      deviceCode: "Device code %{code}",
      deviceCodeHint: "Enter this code on the page that opens, then sign in",
      openAuthPage: "Open the sign-in page",
      authFailed: "Authorization failed",
      authExpired: "The code expired, connect again",
      authDenied: "You cancelled the authorization",
      notConnected: "No OneDrive account connected yet",
      tokenExpired: "Authorization expired, connect again",
      forbidden: "No permission for this file",
      publicClientDisabled: "This Azure app has public client flows disabled",
      connected: "Connected %{email}",
    },

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
