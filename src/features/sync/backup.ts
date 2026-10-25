/**
 * 备份包格式（**纯逻辑**，冒烟可直接测）。
 *
 * ## 打包什么
 *
 * | 数据 | 打包 | 理由 |
 * |---|---|---|
 * | 浏览历史 / 收藏 / 游玩记录 | ✅ | 纯本地数据，换机就没了 |
 * | 攻略标记（已走过 / 重点 / 已达成） | ✅ | **用户数据不是缓存**（见 `features/walkthrough/marks`） |
 * | 应用偏好（主题 / 语言 / 剧透保护…） | ✅ | 换机后不用重设一遍 |
 * | 攻略正文 / 索引 | ❌ | 缓存，能重新下载 |
 * | 每日语录、下载的安装包 | ❌ | 缓存 |
 * | 账号信息 + VNDB Token | ❌ | **凭据不该上传到服务器** |
 *
 * ## 格式
 *
 * JSON（不是 zip）：没有压缩库依赖，且备份文件小到可以直接用文本编辑器看。
 * 顶层带 `format` 版本号，将来格式变了能分辨。
 */

export const BACKUP_APP = "vnlite";
/** 备份格式版本。改动 `data` 的结构时 +1，旧备份按旧版本解析 */
export const BACKUP_FORMAT = 1;
/** WebDAV 上的备份文件名（固定名 —— 上传覆盖，下载拿最新的） */
export const BACKUP_FILE_NAME = "vnlite-backup.json";
/**
 * 头像在 WebDAV 上的文件名。
 *
 * 头像**不塞进备份 JSON**：它是二进制，base64 进 JSON 会让备份体积翻倍、
 * 也没法用文本编辑器打开看。放在备份文件旁边，跟备份一起上传 / 拉取。
 */
export const AVATAR_FILE_NAME = "vnlite-avatar.jpg";

/** 条目类型（与 `lib/db/dao/history` / `favorite` 的存储层一致） */
export type BackupEntryType = "vn" | "character" | "staff" | "producer" | "user";

/** 合法的条目类型（脏数据整条丢掉） */
const ENTRY_TYPES = new Set<string>(["vn", "character", "staff", "producer", "user"]);

export interface BackupHistoryEntry {
  /** 本地行号（0 = 不指定，由 SQLite 分配） */
  id: number;
  type: BackupEntryType;
  entryId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** unix 毫秒 */
  viewedAt: number;
}

export interface BackupFavoriteEntry {
  /** 本地行号（0 = 不指定，由 SQLite 分配） */
  id: number;
  type: BackupEntryType;
  entryId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  /** unix 毫秒 */
  favoritedAt: number;
}

export interface BackupPlaySession {
  /** 本地行号（0 = 不指定，由 SQLite 分配） */
  id: number;
  vnId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export interface BackupData {
  history: BackupHistoryEntry[];
  favorite: BackupFavoriteEntry[];
  playSession: BackupPlaySession[];
  /** 应用偏好（键值对，脏值在恢复时由 `migratePreferences` 收敛） */
  preferences: Record<string, unknown>;
  /** 攻略标记：vid → 标记内容 */
  marks: Record<string, unknown>;
}

export interface BackupPayload {
  app: string;
  format: number;
  /** 打包时间（unix 毫秒） */
  createdAt: number;
  data: BackupData;
}

export function emptyBackupData(): BackupData {
  return { history: [], favorite: [], playSession: [], preferences: {}, marks: {} };
}

/** 组装备份包 */
export function buildBackup(data: BackupData, createdAt: number): BackupPayload {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, createdAt, data };
}

/* -------------------------------------------------------------------------- */
/* 解析（容错）                                                                */
/* -------------------------------------------------------------------------- */

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 条目类型：认不出的整条丢掉（写回库时是非法值） */
function asEntryType(value: unknown): BackupEntryType | null {
  return typeof value === "string" && ENTRY_TYPES.has(value) ? (value as BackupEntryType) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseHistory(raw: unknown): BackupHistoryEntry[] {
  const entries: BackupHistoryEntry[] = [];
  for (const item of asArray(raw)) {
    const record = asRecord(item);
    const type = asEntryType(record.type);
    const entryId = asString(record.entry_id ?? record.entryId);
    const title = asString(record.title);
    // 三个必填字段缺一个就整条丢掉 —— 半截数据恢复出来只会是错的
    if (!type || !entryId || !title) continue;
    entries.push({
      id: asNumber(record.id),
      type,
      entryId,
      title,
      subtitle: asNullableString(record.subtitle),
      imageUrl: asNullableString(record.image_url ?? record.imageUrl),
      viewedAt: asNumber(record.viewed_at ?? record.viewedAt),
    });
  }
  return entries;
}

function parseFavorite(raw: unknown): BackupFavoriteEntry[] {
  const entries: BackupFavoriteEntry[] = [];
  for (const item of asArray(raw)) {
    const record = asRecord(item);
    const type = asEntryType(record.type);
    const entryId = asString(record.entry_id ?? record.entryId);
    const title = asString(record.title);
    if (!type || !entryId || !title) continue;
    entries.push({
      id: asNumber(record.id),
      type,
      entryId,
      title,
      subtitle: asNullableString(record.subtitle),
      imageUrl: asNullableString(record.image_url ?? record.imageUrl),
      favoritedAt: asNumber(record.favorited_at ?? record.favoritedAt),
    });
  }
  return entries;
}

function parsePlaySessions(raw: unknown): BackupPlaySession[] {
  const sessions: BackupPlaySession[] = [];
  for (const item of asArray(raw)) {
    const record = asRecord(item);
    const vnId = asString(record.vn_id ?? record.vnId);
    if (!vnId) continue;
    sessions.push({
      id: asNumber(record.id),
      vnId,
      startedAt: asNumber(record.started_at ?? record.startedAt),
      endedAt: asNumber(record.ended_at ?? record.endedAt),
      durationMs: asNumber(record.duration_ms ?? record.durationMs),
    });
  }
  return sessions;
}

/**
 * 解析备份包。
 *
 * 拿不到合法结构时返回 null（调用方据此提示「这不是 vnlite 的备份」）；
 * 局部脏数据只丢对应的条目，不影响整包。
 */
export function parseBackup(raw: unknown): BackupPayload | null {
  const root = asRecord(raw);
  if (root.app !== BACKUP_APP) return null;
  const format = asNumber(root.format, 0);
  if (format < 1) return null;

  const data = asRecord(root.data);
  return {
    app: BACKUP_APP,
    format,
    createdAt: asNumber(root.createdAt),
    data: {
      history: parseHistory(data.history),
      favorite: parseFavorite(data.favorite),
      playSession: parsePlaySessions(data.playSession),
      preferences: asRecord(data.preferences),
      marks: asRecord(data.marks),
    },
  };
}

/** 备份包的体积（上传前给用户看一眼） */
export function backupSize(payload: BackupPayload): number {
  return JSON.stringify(payload).length;
}
