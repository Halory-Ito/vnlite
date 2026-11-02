import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { t } from "@/lib/i18n/translate";
import { request } from "../http";
import type { ProviderContext, RemoteFileInfo } from "../types";
import { api, BaiduApiError, checkResult, rootPath, type BaiduResult } from "./api";
import { accessToken } from "./oauth";
const CHUNK_SIZE = 4 * 1024 * 1024;

export async function upload(
  ctx: ProviderContext,
  name: string,
  bytes: Uint8Array
): Promise<RemoteFileInfo> {
  const directory = rootPath(ctx);
  try {
    await api(ctx, "file", { method: "create" }, { path: directory, isdir: "1", rtype: "0" });
  } catch (error) {
    if (!(error instanceof BaiduApiError && error.code === -8)) throw error;
  }
  const path = `${directory}/${name}`;
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE)
    chunks.push(bytes.slice(offset, offset + CHUNK_SIZE));
  if (!chunks.length) chunks.push(new Uint8Array());
  const hashes = chunks.map((chunk) => bytesToHex(md5(chunk)));
  const fields = {
    path,
    size: String(bytes.length),
    isdir: "0",
    block_list: JSON.stringify(hashes),
    rtype: "3",
  };
  const pre = await api<
    BaiduResult & { uploadid: string; return_type: number; block_list: number[] }
  >(ctx, "file", { method: "precreate" }, { ...fields, autoinit: "1" });
  if (pre.return_type !== 2) {
    if (!pre.uploadid || !Array.isArray(pre.block_list))
      throw new Error(t("sync.baidu.invalidResponse"));
    const host = "https://d.pcs.baidu.com";
    for (const index of pre.block_list) {
      if (!Number.isInteger(index) || !chunks[index])
        throw new Error(t("sync.baidu.invalidResponse"));
      // Keep native dependencies out of the pure provider registry and Bun smoke tests.
      const { uploadPart } = await import("./file");
      const result = await uploadPart(
        `${host}/rest/2.0/pcs/superfile2?${new URLSearchParams({ method: "upload", type: "tmpfile", path, uploadid: pre.uploadid, partseq: String(index), access_token: await accessToken(ctx) })}`,
        chunks[index]
      );
      checkResult(result);
      if (result.md5 !== hashes[index]) throw new Error(t("sync.baidu.invalidResponse"));
    }
    await api(ctx, "file", { method: "create" }, { ...fields, uploadid: pre.uploadid });
  }
  return { size: bytes.length, modifiedAt: Date.now() };
}
interface RemoteEntry {
  fs_id: number;
  server_filename: string;
  size: number;
  server_mtime: number;
  dlink?: string;
}
export async function download(
  ctx: ProviderContext,
  name: string
): Promise<{ bytes: Uint8Array; info: RemoteFileInfo } | null> {
  let entry: RemoteEntry | undefined;
  for (let start = 0; ; start += 1000) {
    let result: BaiduResult & { list: RemoteEntry[] };
    try {
      result = await api(ctx, "file", {
        method: "list",
        dir: rootPath(ctx),
        start: String(start),
        limit: "1000",
      });
    } catch (error) {
      if (error instanceof BaiduApiError && error.code === -9) return null;
      throw error;
    }
    if (!Array.isArray(result.list)) throw new Error(t("sync.baidu.invalidResponse"));
    entry = result.list.find((file) => file.server_filename === name);
    if (entry || result.list.length < 1000) break;
  }
  if (!entry) return null;
  const meta = await api<BaiduResult & { list: RemoteEntry[] }>(ctx, "multimedia", {
    method: "filemetas",
    fsids: JSON.stringify([entry.fs_id]),
    dlink: "1",
  });
  const link = meta.list?.[0]?.dlink;
  if (!link || !link.startsWith("https://")) throw new Error(t("sync.baidu.invalidResponse"));
  const url = new URL(link);
  if (!/(^|\.)(baidu\.com|baidupcs\.com)$/.test(url.hostname))
    throw new Error(t("sync.baidu.invalidResponse"));
  url.searchParams.set("access_token", await accessToken(ctx));
  const response = await request(url.toString(), { headers: { "User-Agent": "pan.baidu.com" } });
  if (!response.ok) throw new Error(t("sync.requestFailed", { status: String(response.status) }));
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== entry.size) throw new Error(t("sync.baidu.invalidResponse"));
  return { bytes, info: { size: entry.size, modifiedAt: entry.server_mtime * 1000 } };
}
