import { writeBackgroundBytes } from "@/features/settings/lib/background-image";
import type { File } from "expo-file-system";
import type { ProviderContext } from "@/features/sync/lib/providers/types";
import { getProvider } from "@/features/sync/lib/providers/registry";
import { putProviderAsset } from "@/features/sync/lib/providers/avatar";

export async function uploadBackground(
  ctx: ProviderContext,
  file: File,
  name: string
): Promise<void> {
  await putProviderAsset(ctx, name, file);
}

export async function downloadBackground(
  ctx: ProviderContext,
  name: string
): Promise<string | null> {
  const provider = getProvider(ctx.provider);
  if (!provider) return null;
  const bytes = await provider.getAsset(ctx, name);
  return bytes ? writeBackgroundBytes(bytes) : null;
}
