/**
 * 简体中文 · sync 模块（WebDAV 备份同步）。
 *
 * 接入点：`features/sync/*`（「我的 → 同步」页）。
 */
export const zhSync = {
  sync: {
    title: "同步",
    serverSection: "服务器",
    urlLabel: "服务器地址",
    urlPlaceholder: "https://dav.example.com/dav/files/user",
    usernameLabel: "用户名",
    passwordLabel: "密码",
    save: "保存",
    saved: "服务器设置已保存",
    invalidUrl: "服务器地址不对，要以 http:// 或 https:// 开头",

    backupSection: "备份",
    upload: "上传备份",
    download: "下载备份",
    packing: "打包中…",
    uploading: "上传中…",
    downloading: "下载中…",
    restoring: "恢复中…",
    uploaded: "备份已上传",
    restored: "数据已恢复",
    lastSync: "上次同步",
    never: "还没同步过",
    remoteFile: "服务器备份",
    remoteMissing: "服务器上还没有备份",

    restoreTitle: "恢复备份",
    restoreBody:
      "会用服务器上的备份替换本机的浏览历史、收藏、游玩记录、攻略标记与应用设置，且不可撤销。",
    restoreConfirm: "覆盖并恢复",
    backupTime: "备份时间 %{time}",
    itemHistory: "历史 %{count} 条",
    itemFavorite: "收藏 %{count} 条",
    itemPlaySession: "游玩 %{count} 条",
    itemMarks: "攻略标记 %{count} 篇",

    /* ---- 网络错误 ---- */
    unauthorized: "用户名或密码不对",
    forbidden: "没有权限访问这个目录",
    notFound: "服务器上没有这个文件",
    serverError: "服务器出错（HTTP %{status}）",
    requestFailed: "请求失败（HTTP %{status}）",
    networkError: "连不上服务器",
    timeout: "请求超时",
    invalidBackup: "这不是 vnlite 的备份文件",
  },
} as const;
