import { File, Paths, UploadType } from "expo-file-system";
import { t } from "@/lib/i18n/translate";
import { TIMEOUT_MS } from "../http";
import type { BaiduResult } from "./api";

/** Native multipart upload avoids React Native's ArrayBuffer-to-Blob limitation. */
export async function uploadPart(
  url: string,
  bytes: Uint8Array
): Promise<BaiduResult & { md5?: string }> {
  const file = new File(
    Paths.cache,
    `baidu-part-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    file.create();
    file.write(bytes);
    const result = await file.upload(url, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType: "application/octet-stream",
      signal: controller.signal,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(t("sync.requestFailed", { status: String(result.status) }));
    }
    return JSON.parse(result.body);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(t("sync.timeout"), { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    if (file.exists) file.delete();
  }
}
