/**
 * 简体中文 · sync 模块（多份同步配置 + WebDAV 备份同步）。
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
      baidunetdisk: "百度网盘",
      quark: "夸克网盘",
    },
    quark: {
      storageFailed: "无法安全保存授权或上传状态，请检查设备安全存储后重试",
      notConnected: "请重新连接夸克网盘",
      authFailed: "夸克授权失败，请重新获取授权",
      expired: "授权已过期，请重试",
      cancelled: "已取消授权",
      apiError: "夸克网盘请求失败（错误码 %{code}）",
      invalidResponse: "夸克网盘返回的数据不完整",
      invalidDirectory: "请输入有效的目录名称，不要包含路径分隔符",
      directory: "同步目录",
      authorize: "使用夸克授权",
      reconnect: "重新授权",
      openAuthorization: "打开夸克授权",
      qrLabel: "使用夸克 App 扫码授权",
      connected: "已连接夸克网盘",
      openFailed: "无法打开夸克，请确认已安装夸克，或使用夸克扫码授权",
      integrityFailed: "云端文件校验失败，请重新同步",
      pending: "上次上传尚未恢复完成，请稍后重试",
      conflict: "云端文件发生变化，请重试",
      uploadFailed: "夸克文件上传失败",
    },
    baidu: {
      notConnected: "请先连接百度网盘",
      configMissing: "未配置百度网盘 AppKey 或 SecretKey",
      authFailed: "授权失败，请重新获取授权码",
      codeRequired: "请输入授权码",
      apiError: "百度网盘请求失败（错误码 %{code}）",
      invalidResponse: "百度网盘返回的数据不完整",
      invalidPath: "目录必须位于 /apps/应用名称 下",
      directory: "应用目录",
      code: "授权码",
      connect: "确认授权",
      connected: "已连接百度网盘",
      reconnect: "重新授权",
      openAuthorization: "打开百度授权页面",
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

    uploadConfirmTitle: "覆盖云端备份？",
    uploadConfirmBody: "将使用本机数据覆盖云端已有备份，且不可撤销。",
    uploadConfirm: "覆盖并上传",

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
