import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { t } from "@/lib/i18n/translate";
import type { ProviderContext, RemoteFileInfo } from "../types";
import { api } from "./api";
import { delay } from "./auth";
import { authenticated, trustedUrl } from "./network";

export interface Entry {
  fid: string;
  file_name: string;
  size: number;
  updated_at?: number;
  dir?: boolean;
  file?: boolean;
}
export class IntegrityError extends Error {
  constructor() {
    super(t("sync.quark.integrityFailed"));
  }
}
export const digest = (bytes: Uint8Array) => bytesToHex(sha256(bytes));
export async function list(ctx: ProviderContext, parent: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api<{ list: Entry[] }>(ctx, "/file/sort", undefined, {
      pdir_fid: parent,
      _page: String(page),
      _size: "100",
    });
    if (!Array.isArray(result.data?.list)) throw new Error(t("sync.quark.invalidResponse"));
    entries.push(...result.data.list);
    if (result.data.list.length < 100) return entries;
  }
  throw new Error(t("sync.quark.invalidResponse"));
}
export function named(entries: Entry[], name: string): Entry | undefined {
  const found = entries.filter((e) => e.file_name === name);
  if (found.length > 1) throw new Error(t("sync.quark.conflict"));
  return found[0];
}
export async function directory(ctx: ProviderContext, create: boolean): Promise<string | null> {
  const name = ctx.options.directory || "vnlite";
  const existing = named(await list(ctx, "0"), name);
  if (existing) {
    if (!existing.dir) throw new Error(t("sync.quark.conflict"));
    return existing.fid;
  }
  if (!create) return null;
  const result = await api<{ fid: string }>(ctx, "/file", {
    pdir_fid: "0",
    file_name: name,
    dir_path: "",
    dir_init_lock: false,
  });
  if (!result.data?.fid) throw new Error(t("sync.quark.invalidResponse"));
  return result.data.fid;
}
export const info = (entry: Entry): RemoteFileInfo => ({
  size: entry.size,
  modifiedAt: entry.updated_at ?? null,
});
export async function read(ctx: ProviderContext, entry: Entry): Promise<Uint8Array> {
  const result = await api<{ fid?: string; download_url: string }[]>(ctx, "/file/download", {
    fids: [entry.fid],
  });
  const link = result.data?.[0]?.download_url;
  if (!link) throw new Error(t("sync.quark.invalidResponse"));
  trustedUrl(link);
  const response = await authenticated(ctx, link);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== entry.size) throw new IntegrityError();
  return bytes;
}
export async function poll(
  ctx: ProviderContext,
  dir: string,
  match: (entries: Entry[]) => boolean
): Promise<Entry[]> {
  for (let i = 0; i < 12; i++) {
    const entries = await list(ctx, dir);
    if (match(entries)) return entries;
    if (i < 11) await delay(1500);
  }
  throw new Error(t("sync.quark.pending"));
}
export async function verify(
  ctx: ProviderContext,
  dir: string,
  fid: string,
  hash: string,
  size: number
): Promise<Entry> {
  const entries = await poll(ctx, dir, (items) => items.some((e) => e.fid === fid));
  const entry = entries.find((e) => e.fid === fid)!;
  if (entry.size !== size || digest(await read(ctx, entry)) !== hash) throw new IntegrityError();
  return entry;
}
export async function rename(
  ctx: ProviderContext,
  dir: string,
  fid: string,
  name: string
): Promise<void> {
  await api(ctx, "/file/rename", { fid, file_name: name });
  await poll(ctx, dir, (items) => items.some((e) => e.fid === fid && e.file_name === name));
}
export async function remove(ctx: ProviderContext, dir: string, fid: string): Promise<void> {
  await api(ctx, "/file/delete", { action_type: 1, exclude_fids: [], filelist: [fid] });
  await poll(ctx, dir, (items) => !items.some((e) => e.fid === fid));
}
