import type { SyncSecretStore } from "../types";
import { t } from "@/lib/i18n/translate";

interface Cookie {
  name: string;
  value: string;
  domain: string;
  hostOnly: boolean;
  path: string;
  expires?: number;
}
const SLOT_KEY = "quarkCookieSlot";
export const COOKIE_KEYS = [
  SLOT_KEY,
  ...["A", "B"].flatMap((slot) => Array.from({ length: 16 }, (_, i) => `quarkCookie${slot}${i}`)),
];

/** Per-config jar; never use the process-wide native cookie store. */
export class CookieJar {
  constructor(private items: Cookie[] = []) {}
  header(url: string): string {
    const { hostname, pathname } = new URL(url);
    return this.items
      .filter(
        (c) =>
          (!c.expires || c.expires > Date.now()) &&
          (hostname === c.domain || (!c.hostOnly && hostname.endsWith(`.${c.domain}`))) &&
          (pathname === c.path || pathname.startsWith(c.path.endsWith("/") ? c.path : `${c.path}/`))
      )
      .sort((a, b) => b.path.length - a.path.length)
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }
  absorb(url: string, headers: Headers): boolean {
    const hostname = new URL(url).hostname;
    const getter = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const lines = getter
      ? getter.call(headers)
      : (headers.get("set-cookie") ?? "").split(/,(?=\s*[^;,=\s]+=)/);
    let changed = false;
    for (const line of lines) {
      const [pair, ...attrs] = line.split(";");
      const equal = pair.indexOf("=");
      if (equal < 1) continue;
      const name = pair.slice(0, equal).trim(),
        value = pair.slice(equal + 1).trim();
      if (!/^[\w-]+$/.test(name) || /[\r\n;]/.test(value)) continue;
      const fields = new Map(
        attrs.map((a) => {
          const i = a.indexOf("=");
          return [
            a
              .slice(0, i < 0 ? undefined : i)
              .trim()
              .toLowerCase(),
            i < 0 ? "" : a.slice(i + 1).trim(),
          ];
        })
      );
      const domain = (fields.get("domain") || hostname).replace(/^\./, "").toLowerCase();
      if (hostname !== domain && !hostname.endsWith(`.${domain}`)) continue;
      if (!/(^|\.)(quark\.cn|quark\.com|ucweb\.com|uc\.cn)$/.test(domain)) continue;
      const path = fields.get("path")?.startsWith("/") ? fields.get("path")! : "/";
      let expires = fields.has("expires") ? Date.parse(fields.get("expires")!) : undefined;
      if (fields.has("max-age")) expires = Date.now() + Number(fields.get("max-age")) * 1000;
      this.items = this.items.filter(
        (c) => !(c.name === name && c.domain === domain && c.path === path)
      );
      if (expires === undefined || !Number.isFinite(expires) || expires > Date.now())
        this.items.push({
          name,
          value,
          domain,
          path,
          hostOnly: !fields.has("domain"),
          expires: Number.isFinite(expires) ? expires : undefined,
        });
      changed = true;
    }
    return changed;
  }
  serialize(): string {
    return JSON.stringify(this.items.filter((c) => !c.expires || c.expires > Date.now()));
  }
  static async load(store: SyncSecretStore): Promise<CookieJar> {
    const pointer = await store.get(SLOT_KEY);
    if (!pointer) return new CookieJar();
    const match = /^([AB]):(\d+)$/.exec(pointer);
    const count = Number(match?.[2]);
    if (!match || count < 1 || count > 16) throw new Error(t("sync.quark.notConnected"));
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => store.get(`quarkCookie${match[1]}${i}`))
    );
    if (chunks.some((c) => c === null)) throw new Error(t("sync.quark.notConnected"));
    try {
      const items = JSON.parse(chunks.join(""));
      if (!Array.isArray(items)) throw Error();
      return new CookieJar(items);
    } catch {
      throw new Error(t("sync.quark.notConnected"));
    }
  }
  async save(store: SyncSecretStore): Promise<void> {
    const previous = await store.get(SLOT_KEY);
    const slot = previous?.startsWith("A:") ? "B" : "A";
    const text = this.serialize();
    const count = Math.ceil(text.length / 1500);
    if (count > 16) throw new Error(t("sync.quark.invalidResponse"));
    for (let i = 0; i < count; i++)
      await store.set(`quarkCookie${slot}${i}`, text.slice(i * 1500, (i + 1) * 1500));
    // Publish only after all encrypted chunks are saved.
    await store.set(SLOT_KEY, `${slot}:${count}`);
  }
}
