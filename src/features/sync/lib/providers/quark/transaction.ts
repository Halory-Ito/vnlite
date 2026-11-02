import { t } from "@/lib/i18n/translate";
import type { ProviderContext } from "../types";
import { digest, IntegrityError, list, named, rename, remove, verify, type Entry } from "./files";
import { uploadNew } from "./upload";

export const TRANSACTION_KEY = "quarkTransaction";
interface Transaction {
  directory: string;
  name: string;
  temporary: string;
  rollback: string;
  hash: string;
  size: number;
  original?: string;
  staged?: string;
  phase: "uploading" | "verified" | "moving" | "promoted";
}
const pending = () => new Error(t("sync.quark.pending"));
async function save(ctx: ProviderContext, tx: Transaction) {
  await ctx.secrets.set(TRANSACTION_KEY, JSON.stringify(tx));
}
function parse(raw: string): Transaction {
  try {
    const tx = JSON.parse(raw) as Transaction;
    if (
      !tx.directory ||
      !tx.name ||
      !tx.temporary?.startsWith(".vnlite-") ||
      !tx.rollback?.startsWith(".vnlite-") ||
      !/^[a-f0-9]{64}$/.test(tx.hash) ||
      !Number.isSafeInteger(tx.size) ||
      tx.size < 0 ||
      !["uploading", "verified", "moving", "promoted"].includes(tx.phase)
    )
      throw Error();
    return tx;
  } catch {
    throw pending();
  }
}

/** Reconcile actual IDs after an interrupted response; never guess by same-name upload. */
export async function recover(ctx: ProviderContext): Promise<void> {
  const raw = await ctx.secrets.get(TRANSACTION_KEY);
  if (!raw) return;
  const tx = parse(raw);
  let entries = await list(ctx, tx.directory);
  const original = entries.find((e) => e.fid === tx.original);
  const staged = entries.find((e) => e.fid === tx.staged) ?? named(entries, tx.temporary);
  const current = named(entries, tx.name);
  if (current && current.fid !== tx.original && current.fid !== staged?.fid) throw pending();
  if (current && current.fid === staged?.fid) {
    try {
      await verify(ctx, tx.directory, current.fid, tx.hash, tx.size);
    } catch (error) {
      if (!(error instanceof IntegrityError) || !original || original.file_name !== tx.rollback)
        throw error;
      if (named(entries, tx.temporary)) throw pending();
      await rename(ctx, tx.directory, current.fid, tx.temporary);
      await rename(ctx, tx.directory, original.fid, tx.name);
      await remove(ctx, tx.directory, current.fid);
      await ctx.secrets.remove(TRANSACTION_KEY);
      return;
    }
    if (original) {
      if (original.file_name !== tx.rollback) throw pending();
      await remove(ctx, tx.directory, original.fid);
    }
  } else if (original) {
    // Until the new file owns the canonical name, restore the previous good backup.
    if (original.file_name === tx.rollback && !current)
      await rename(ctx, tx.directory, original.fid, tx.name);
    else if (original.file_name !== tx.name) throw pending();
    if (staged) {
      if (staged.file_name !== tx.temporary) throw pending();
      await remove(ctx, tx.directory, staged.fid);
    }
  } else if (tx.original) {
    // Missing original with no verified replacement: retain the journal for recovery.
    throw pending();
  } else if (staged) {
    if (staged.file_name !== tx.temporary) throw pending();
    if (tx.phase !== "uploading") {
      await verify(ctx, tx.directory, staged.fid, tx.hash, tx.size);
      await rename(ctx, tx.directory, staged.fid, tx.name);
      await verify(ctx, tx.directory, staged.fid, tx.hash, tx.size);
    } else await remove(ctx, tx.directory, staged.fid);
  }
  entries = await list(ctx, tx.directory);
  if (entries.some((e) => e.file_name === tx.temporary || e.file_name === tx.rollback))
    throw pending();
  await ctx.secrets.remove(TRANSACTION_KEY);
}

export async function replace(
  ctx: ProviderContext,
  dir: string,
  name: string,
  bytes: Uint8Array
): Promise<Entry> {
  const entries = await list(ctx, dir),
    original = named(entries, name);
  if (original?.dir) throw new Error(t("sync.quark.conflict"));
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const suffix = name.endsWith(".jpg") ? ".jpg" : ".json";
  const tx: Transaction = {
    directory: dir,
    name,
    temporary: `.vnlite-${nonce}-pending${suffix}`,
    rollback: `.vnlite-${nonce}-rollback${suffix}`,
    hash: digest(bytes),
    size: bytes.length,
    original: original?.fid,
    phase: "uploading",
  };
  await save(ctx, tx);
  // On errors leave the durable journal intact; the next read/write reconciles first.
  tx.staged = await uploadNew(ctx, dir, tx.temporary, bytes, async (fid) => {
    tx.staged = fid;
    await save(ctx, tx);
  });
  await verify(ctx, dir, tx.staged, tx.hash, tx.size);
  tx.phase = "verified";
  await save(ctx, tx);
  const before = await list(ctx, dir);
  if (named(before, name)?.fid !== original?.fid) throw new Error(t("sync.quark.conflict"));
  tx.phase = "moving";
  await save(ctx, tx);
  if (original) await rename(ctx, dir, original.fid, tx.rollback);
  await rename(ctx, dir, tx.staged, name);
  const result = await verify(ctx, dir, tx.staged, tx.hash, tx.size);
  tx.phase = "promoted";
  await save(ctx, tx);
  if (original) await remove(ctx, dir, original.fid);
  await ctx.secrets.remove(TRANSACTION_KEY);
  return result;
}
