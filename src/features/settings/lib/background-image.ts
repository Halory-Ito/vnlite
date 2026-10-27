/**
 * 自定义背景图（本地文件）。
 *
 * 与自定义头像同一套思路（见 `features/profile/lib/avatar`），但**不需要订阅**：
 * 背景图地址存在偏好里（`backgroundUrl`），偏好本身已经是可订阅的。
 *
 * 换图时文件名带时间戳：固定名覆盖会让 `expo-image` 命中旧缓存。
 * 存在 `document` 目录而不是 `cache`：背景图是用户设置，不能被系统清掉。
 */

import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const FILE_PREFIX = "background-";
const FILE_EXT = ".jpg";
/**
 * 落盘宽度（px）。
 *
 * 背景会被遮罩压暗、通常还会模糊，不需要原图分辨率；
 * 1440 足够 3 倍屏平板横屏铺满，同时把几十 MB 的原图压到几百 KB。
 */
const MAX_WIDTH = 1440;
/** JPEG 压缩质量 */
const QUALITY = 0.82;

export type BackgroundPickResult =
  | { status: "saved"; uri: string }
  | { status: "cancelled" }
  | { status: "failed" };

/** 打开相册选图 → 压到 `MAX_WIDTH` → 落盘，返回新文件地址 */
export async function pickBackgroundImage(): Promise<BackgroundPickResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // 背景图不需要裁剪：设备比例各不相同，位置交给滑杆微调
      quality: 1,
    });
    const picked = result.assets?.[0]?.uri;
    if (result.canceled || !picked) return { status: "cancelled" };

    const rendered = await ImageManipulator.manipulate(picked)
      .resize({ width: MAX_WIDTH })
      .renderAsync();
    const image = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

    const file = new File(Paths.document, `${FILE_PREFIX}${Date.now()}${FILE_EXT}`);
    file.create({ overwrite: true });
    file.write(await new File(image.uri).bytes());
    // 写成功之后才删旧的：失败时原来那张还在
    removeBackgroundFilesExcept(file.uri);
    return { status: "saved", uri: file.uri };
  } catch {
    return { status: "failed" };
  }
}

/** 删掉所有本地背景图（用户选择「恢复主题背景」时调用） */
export function clearBackgroundImages(): void {
  removeBackgroundFilesExcept(null);
}

function removeBackgroundFilesExcept(keepUri: string | null): void {
  let files: File[];
  try {
    files = Paths.document
      .list()
      .filter(
        (entry): entry is File => entry instanceof File && entry.name.startsWith(FILE_PREFIX)
      );
  } catch {
    return;
  }

  for (const file of files) {
    if (file.uri === keepUri) continue;
    try {
      file.delete();
    } catch {
      // 删不掉就算了：只是占一点空间，下次换图会换新名字
    }
  }
}
