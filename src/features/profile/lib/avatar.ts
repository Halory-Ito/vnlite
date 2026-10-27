/**
 * 自定义头像（本地文件 + 内存订阅）。
 *
 * ## 为什么存文件不存 base64
 *
 * 头像是一张图，塞进 AsyncStorage 会让每次偏好读写都拖着几百 KB 的字符串；
 * 放进 `document` 目录也只多一次文件读取。`cache` 目录不行 —— 系统空间紧张时
 * 会把它清掉，头像属于用户数据。
 *
 * ## 为什么文件名带时间戳
 *
 * 固定文件名（`avatar.jpg`）覆盖写入时，`expo-image` 会按 URI 命中自己的磁盘缓存，
 * 换完头像还是显示旧图。每次写新名字（`avatar-<ms>.jpg`）并删掉旧的，
 * URI 变了缓存自然失效。
 *
 * ## 订阅
 *
 * 「我的」头像是跨页面共享的状态，用模块级快照 + `useSyncExternalStore`
 * （与偏好、登录态同一套做法）。
 */

import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** 文件名前缀（后面接时间戳） */
const FILE_PREFIX = "avatar-";
const FILE_EXT = ".jpg";
/**
 * 落盘边长（px）。界面最大只画 64dp，512 在 8 倍屏上也够清晰，
 * 同时把动辄几 MB 的原图压成几十 KB —— 上传 WebDAV 不心疼。
 */
const AVATAR_EDGE = 512;
/** JPEG 压缩质量 */
const QUALITY = 0.85;

let currentUri: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 本地所有头像文件（正常只会有一个） */
function avatarFiles(): File[] {
  try {
    return Paths.document
      .list()
      .filter(
        (entry): entry is File => entry instanceof File && entry.name.startsWith(FILE_PREFIX)
      );
  } catch {
    return [];
  }
}

/** 最新的那个头像文件（正常只会有一个） */
function newestAvatar(): File | null {
  const files = avatarFiles();
  if (files.length === 0) return null;
  return files.reduce((best, file) =>
    (file.lastModified ?? 0) > (best.lastModified ?? 0) ? file : best
  );
}

export function getAvatarUri(): string | null {
  return currentUri;
}

export function subscribeAvatar(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 启动时读一次磁盘。没有头像时 `getAvatarUri()` 是 null（界面画字母兜底） */
export async function loadAvatar(): Promise<void> {
  currentUri = newestAvatar()?.uri ?? null;
  emit();
}

export type AvatarPickResult = "saved" | "cancelled" | "failed";

/** 打开相册选图 → 1:1 裁剪 → 压到 `AVATAR_EDGE` → 落盘 */
export async function pickAvatar(): Promise<AvatarPickResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    const picked = result.assets?.[0]?.uri;
    if (result.canceled || !picked) return "cancelled";

    const rendered = await ImageManipulator.manipulate(picked)
      .resize({ width: AVATAR_EDGE, height: AVATAR_EDGE })
      .renderAsync();
    const image = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    await writeAvatarBytes(await new File(image.uri).bytes());
    return "saved";
  } catch {
    return "failed";
  }
}

/**
 * 用一份图片字节覆盖本地头像（同步恢复时用）。
 *
 * 先写新文件、成功了再删旧的：写一半失败（空间不足 / 字节坏了）时
 * 原来那张还在，不会白白丢头像。
 */
export async function writeAvatarBytes(bytes: Uint8Array): Promise<void> {
  const file = new File(Paths.document, `${FILE_PREFIX}${Date.now()}${FILE_EXT}`);
  file.create({ overwrite: true });
  file.write(bytes);
  removeAvatarFilesExcept(file.uri);
  currentUri = file.uri;
  emit();
}

/** 删掉头像（界面上是「移除头像」） */
export async function removeAvatar(): Promise<void> {
  removeAvatarFilesExcept(null);
  currentUri = null;
  emit();
}

/** 只留下 `keepUri` 那个（传 null 等于全删） */
function removeAvatarFilesExcept(keepUri: string | null): void {
  for (const file of avatarFiles()) {
    if (file.uri === keepUri) continue;
    try {
      file.delete();
    } catch {
      // 删不掉就算了：下次写入会换新文件名，旧的只是占一点空间
    }
  }
}

/** 上传 WebDAV 用的本地文件（没有头像时 null） */
export function avatarUploadFile(): File | null {
  return newestAvatar();
}
