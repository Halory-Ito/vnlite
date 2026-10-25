/**
 * English · sync module (WebDAV backup sync).
 *
 * 接入点：`features/sync/*`（"Me → Sync" screen）。
 */
import type { CatalogOf } from "../catalog-types";
import { zhSync } from "../zh/sync";

export const enSync: CatalogOf<typeof zhSync> = {
  sync: {
    title: "Sync",
    serverSection: "Server",
    urlLabel: "Server URL",
    urlPlaceholder: "https://dav.example.com/dav/files/user",
    usernameLabel: "Username",
    passwordLabel: "Password",
    save: "Save",
    saved: "Server settings saved",
    invalidUrl: "The server URL must start with http:// or https://",

    backupSection: "Backup",
    upload: "Upload backup",
    download: "Download backup",
    packing: "Packing…",
    uploading: "Uploading…",
    downloading: "Downloading…",
    restoring: "Restoring…",
    uploaded: "Backup uploaded",
    restored: "Data restored",
    lastSync: "Last sync",
    never: "Never synced",
    remoteFile: "Remote backup",
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
