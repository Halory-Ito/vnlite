import type { ProviderContext, RemoteFileInfo } from "../types";
import { directory, info, list, named, read } from "./files";
import { serial } from "./network";
import { recover, replace } from "./transaction";

// Serialize uploads, reads and recovery within a config, including avatar operations.
export function upload(
  ctx: ProviderContext,
  name: string,
  bytes: Uint8Array
): Promise<RemoteFileInfo> {
  return serial(`files:${ctx.configId}`, async () => {
    await recover(ctx);
    const dir = (await directory(ctx, true))!;
    return info(await replace(ctx, dir, name, bytes));
  });
}
export function download(
  ctx: ProviderContext,
  name: string
): Promise<{ bytes: Uint8Array; info: RemoteFileInfo } | null> {
  return serial(`files:${ctx.configId}`, async () => {
    await recover(ctx);
    const dir = await directory(ctx, false);
    if (!dir) return null;
    const entry = named(await list(ctx, dir), name);
    if (!entry) return null;
    return { bytes: await read(ctx, entry), info: info(entry) };
  });
}
