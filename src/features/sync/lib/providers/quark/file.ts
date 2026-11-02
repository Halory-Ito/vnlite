import { File, Paths, UploadType } from "expo-file-system";
import { t } from "@/lib/i18n/translate";
import { TIMEOUT_MS } from "../http";

/** OSS expects raw bytes; multipart/form-data changes the signed content. */
export async function putPart(
  url: string,
  bytes: Uint8Array,
  headers: Record<string, string>
): Promise<string> {
  const file = new File(
    Paths.cache,
    `quark-part-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    file.create();
    file.write(bytes);
    const response = await file.upload(url, {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT,
      headers,
      signal: controller.signal,
      sessionType: "foreground",
    });
    if (response.status < 200 || response.status >= 300)
      throw new Error(t("sync.requestFailed", { status: String(response.status) }));
    const etag = Object.entries(response.headers).find(
      ([key]) => key.toLowerCase() === "etag"
    )?.[1];
    if (!etag || !/^"?[\w-]+"?$/.test(etag)) throw new Error(t("sync.quark.invalidResponse"));
    return etag;
  } catch {
    throw new Error(t(controller.signal.aborted ? "sync.timeout" : "sync.quark.uploadFailed"));
  } finally {
    clearTimeout(timer);
    if (file.exists) file.delete();
  }
}
