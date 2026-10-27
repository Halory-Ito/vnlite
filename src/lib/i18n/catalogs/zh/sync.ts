/**
 * 简体中文 · sync 模块（多份同步配置 + WebDAV / OneDrive 备份同步）。
 *
 * 接入点：`features/sync/*`（「我的 → 同步」页）。
 */
export const zhSync = {
  sync: {
    title: "同步",
    urlLabel: "服务器地址",
    urlPlaceholder: "https://dav.example.com/dav/files/user",
    usernameLabel: "用户名",
    passwordLabel: "密码",
    save: "保存",
    invalidUrl: "服务器地址不对，要以 http:// 或 https:// 开头",

    /* ---- 配置列表 ---- */
    configsSection: "同步配置",
    noConfigs: "还没有同步配置，点下面加一个",
    addConfig: "添加配置",
    newConfigTitle: "新建同步配置",
    editConfigTitle: "编辑同步配置",
    configNameLabel: "配置名称",
    configNamePlaceholder: "如：我的坚果云",
    nameRequired: "给这份配置起个名字",
    serviceLabel: "服务",
    currentBadge: "当前",
    setCurrent: "设为当前配置",
    editConfig: "编辑配置",
    deleteConfig: "删除配置",
    deleteConfigTitle: "删除这份配置？",
    deleteConfigBody: "会删掉这份配置的登录信息与同步记录，服务器上的备份文件不受影响。",
    providerNotReady: "这个服务还没接上",
    comingSoon: "即将推出",
    configMissing: "这份配置不存在，可能已经被删掉了",

    /* ---- 供应商 ---- */
    provider: {
      webdav: "WebDAV",
      onedrive: "OneDrive",
      googleDrive: "Google Drive",
      quark: "夸克网盘",
    },

    /* ---- 同步状态 ---- */
    statusSyncing: "同步中…",
    statusFailedDetail: "同步失败：%{error}",
    lastSyncAt: "上次同步 %{time}",
    never: "还没同步过",

    upload: "上传备份",
    download: "下载备份",
    uploaded: "备份已上传",
    restored: "数据已恢复",
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

    /* ---- OneDrive ---- */
    onedrive: {
      clientIdLabel: "应用 ID",
      clientIdPlaceholder: "Azure 应用注册的客户端 ID",
      clientIdHint: "在 Azure 应用注册里建一个应用，打开「允许公共客户端流」，把应用 ID 填到这里",
      clientIdRequired: "填一下应用 ID",
      connect: "连接 OneDrive",
      reconnect: "换个账号",
      disconnect: "断开连接",
      connecting: "等待授权…",
      deviceCode: "设备码 %{code}",
      deviceCodeHint: "在打开的页面里输入这串码，然后登录你的账号",
      openAuthPage: "打开验证页面",
      authFailed: "授权失败",
      authExpired: "授权码过期了，重新连一次",
      authDenied: "你取消了授权",
      notConnected: "还没连接 OneDrive 账号",
      tokenExpired: "授权已失效，重新连一次",
      forbidden: "没有权限访问这个文件",
      publicClientDisabled: "这个 Azure 应用没开「允许公共客户端流」",
      connected: "已连接 %{email}",
    },

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
