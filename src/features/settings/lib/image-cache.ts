import { File, Directory, Paths } from "expo-file-system";
import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const IMAGE_CACHE_CATEGORIES = [
  "vn",
  "character",
  "producer",
  "staff",
  "community",
  "screenshots",
] as const;
export type ImageCacheCategory = (typeof IMAGE_CACHE_CATEGORIES)[number];

const ROOT = new Directory(Paths.cache, "vnlite-images");
const pending = new Map<string, Promise<string>>();
const clearing = new Map<ImageCacheCategory, Promise<void>>();

function imageFileName(url: string): string {
  const extension =
    new URL(url).pathname.match(/\.(avif|gif|jpe?g|png|webp)$/i)?.[1]?.toLowerCase() ?? "jpg";
  return `${bytesToHex(sha256(new TextEncoder().encode(url)))}.${extension}`;
}

export function imageCacheDirectory(category: ImageCacheCategory): Directory {
  return new Directory(ROOT, category);
}

export async function cacheImage(url: string, category: ImageCacheCategory): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return url;
  if (clearing.has(category)) return url;
  const key = `${category}:${url}`;
  const existing = pending.get(key);
  if (existing) return existing;

  const task = (async (): Promise<string> => {
    const directory = imageCacheDirectory(category);
    const file = new File(directory, imageFileName(url));
    if (file.exists && (file.info().size ?? 0) > 0) return file.uri;

    directory.create({ intermediates: true, idempotent: true });
    try {
      await File.downloadFileAsync(url, file, { idempotent: true });
      if (!file.exists || (file.info().size ?? 0) === 0) throw new Error("Empty image cache file");
      return file.uri;
    } catch (error) {
      try {
        if (file.exists) file.delete();
      } catch {
        // A failed cache write must not prevent the remote image fallback.
      }
      throw error;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, task);
  return task;
}

export async function prefetchImages(
  urls: readonly string[],
  category: ImageCacheCategory
): Promise<void> {
  await Promise.allSettled(urls.map((url) => cacheImage(url, category)));
}

export async function getImageCacheStats(): Promise<Record<ImageCacheCategory, number>> {
  const entries = await Promise.all(
    IMAGE_CACHE_CATEGORIES.map(async (category) => {
      try {
        const files = imageCacheDirectory(category)
          .list()
          .filter((item): item is File => item instanceof File);
        const size = files.reduce((total, file) => total + (file.info().size ?? 0), 0);
        return [category, size] as const;
      } catch {
        return [category, 0] as const;
      }
    })
  );
  return Object.fromEntries(entries) as Record<ImageCacheCategory, number>;
}

export async function clearImageCacheCategory(category: ImageCacheCategory): Promise<void> {
  const activeClear = clearing.get(category);
  if (activeClear) await activeClear;
  const task = (async () => {
    await Promise.allSettled(
      [...pending.entries()]
        .filter(([key]) => key.startsWith(`${category}:`))
        .map(([, promise]) => promise)
    );
    const directory = imageCacheDirectory(category);
    try {
      if (directory.exists) directory.delete();
    } catch {
      // The operating system may already have evicted this cache directory.
    }
  })();
  clearing.set(category, task);
  try {
    await task;
  } finally {
    if (clearing.get(category) === task) clearing.delete(category);
  }
}
