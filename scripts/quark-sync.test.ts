// @ts-expect-error Bun test types are supplied by the Bun runtime.
import { test, expect, afterEach, mock } from "bun:test";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { ProviderContext } from "../src/features/sync/lib/providers/types";
import { SECRET_KEYS } from "../src/features/sync/lib/configs/secret-key";
import { CookieJar } from "../src/features/sync/lib/providers/quark/cookies";
import { startLogin, finishLogin } from "../src/features/sync/lib/providers/quark/auth";
import { api } from "../src/features/sync/lib/providers/quark/api";
import { trustedUrl } from "../src/features/sync/lib/providers/quark/network";
import { authenticated } from "../src/features/sync/lib/providers/quark/network";
import { upload, download } from "../src/features/sync/lib/providers/quark/client";
import { digest } from "../src/features/sync/lib/providers/quark/files";
import { TRANSACTION_KEY, recover } from "../src/features/sync/lib/providers/quark/transaction";
import { QUARK_PROVIDER } from "../src/features/sync/lib/providers/quark/provider";
const originalFetch = globalThis.fetch;
mock.module("expo/fetch", () => ({
  fetch: (url: string, init: RequestInit) => globalThis.fetch(url, init),
}));
const temporary = new Set<NativeFile>();
class NativeFile {
  exists = false;
  data: Uint8Array = new Uint8Array();
  create() {
    this.exists = true;
    temporary.add(this);
  }
  write(bytes: Uint8Array) {
    this.data = bytes.slice();
  }
  delete() {
    this.exists = false;
    temporary.delete(this);
  }
  async upload(
    url: string,
    options: { headers: Record<string, string>; httpMethod: string; uploadType: number }
  ) {
    expect(options.httpMethod).toBe("PUT");
    expect(options.uploadType).toBe(0);
    expect(options.headers["Content-Type"]).toBeDefined();
    const response = await fetch(url, {
      method: "PUT",
      headers: options.headers,
      body: this.data as BodyInit,
    });
    return {
      status: response.status,
      body: await response.text(),
      headers: Object.fromEntries(response.headers),
    };
  }
}
mock.module("expo-file-system", () => ({
  File: NativeFile,
  Paths: { cache: "file:///cache" },
  UploadType: { BINARY_CONTENT: 0 },
}));
afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(temporary.size).toBe(0);
});
const json = (data: unknown) => Response.json(data);
const ok = (data: unknown) => json({ status: 200, code: 0, data });
function route(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((input: string | URL | Request, init: RequestInit = {}) =>
    Promise.resolve(handler(new URL(String(input)), init))) as typeof fetch;
}
async function context(id = "quark-test") {
  const values = new Map<string, string>();
  const ctx: ProviderContext = {
    provider: "quark",
    configId: id,
    options: { directory: "vnlite" },
    secrets: {
      get: async (key) => values.get(key) ?? null,
      set: async (key, value) => {
        values.set(key, value);
      },
      remove: async (key) => {
        values.delete(key);
      },
    },
  };
  const jar = new CookieJar();
  jar.absorb(
    "https://pan.quark.cn/",
    new Headers({ "set-cookie": "__puus=session; Domain=.quark.cn; Path=/; Secure" })
  );
  await jar.save(ctx.secrets);
  return ctx;
}
const bytes = (value: string) => new TextEncoder().encode(value);

test("cookie domains, rotation, expiry and multi-header fallback stay isolated", () => {
  const jar = new CookieJar();
  const headers = {
    get: (name: string) =>
      name === "set-cookie"
        ? "__puus=one; Domain=.quark.cn; Path=/; Expires=Thu, 01 Jan 2037 00:00:00 GMT, sid=two; Path=/account"
        : null,
  } as Headers;
  jar.absorb("https://pan.quark.cn/account/info", headers);
  expect(jar.header("https://drive-pc.quark.cn/1/clouddrive")).toBe("__puus=one");
  expect(jar.header("https://pan.quark.cn/account/info")).toContain("sid=two");
  expect(jar.header("https://pan.quark.cn/accounting")).not.toContain("sid=two");
  expect(jar.header("https://evilquark.cn/")).toBe("");
  jar.absorb(
    "https://pan.quark.cn/",
    new Headers({ "set-cookie": "__puus=rotated; Domain=quark.cn; Path=/" })
  );
  expect(jar.header("https://drive-pc.quark.cn/")).toBe("__puus=rotated");
  jar.absorb(
    "https://pan.quark.cn/",
    new Headers({ "set-cookie": "__puus=; Domain=quark.cn; Path=/; Max-Age=0" })
  );
  expect(jar.header("https://drive-pc.quark.cn/")).toBe("");
});
test("encrypted cookie chunks publish atomically and are isolated by config", async () => {
  const first = await context("cookie-a"),
    second = await context("cookie-b");
  const jar = new CookieJar();
  jar.absorb(
    "https://pan.quark.cn/",
    new Headers({ "set-cookie": `large=${"x".repeat(3200)}; Domain=quark.cn; Path=/` })
  );
  await jar.save(first.secrets);
  expect((await CookieJar.load(first.secrets)).header("https://drive-pc.quark.cn/")).toContain(
    "large="
  );
  expect((await CookieJar.load(second.secrets)).header("https://drive-pc.quark.cn/")).toBe(
    "__puus=session"
  );
  const failing = {
    ...first.secrets,
    set: async (key: string, value: string) => {
      if (key.endsWith("1")) throw Error("storage full");
      await first.secrets.set(key, value);
    },
  };
  await expect(jar.save(failing)).rejects.toThrow();
  expect((await CookieJar.load(first.secrets)).header("https://drive-pc.quark.cn/")).toContain(
    "large="
  );
});
test("QR login exchanges the ticket and stores cookies without using global credentials", async () => {
  const ctx = await context();
  const controller = new AbortController();
  let seen = 0;
  route((url, init) => {
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("manual");
    seen++;
    if (url.pathname.endsWith("getTokenForQrcodeLogin"))
      return json({ status: 2000000, data: { members: { token: "qr-token" } } });
    if (url.pathname.endsWith("getServiceTicketByQrcodeToken"))
      return json({ status: 2000000, data: { members: { service_ticket: "ticket" } } });
    expect(url.searchParams.get("st")).toBe("ticket");
    return Response.json(
      { success: true },
      { headers: { "set-cookie": "__puus=authorized; Domain=.quark.cn; Path=/" } }
    );
  });
  const login = await startLogin(controller.signal);
  expect(login.url).toContain("qr-token");
  await finishLogin(ctx, login, controller.signal);
  expect(seen).toBe(3);
  expect((await CookieJar.load(ctx.secrets)).header("https://drive-pc.quark.cn/")).toBe(
    "__puus=authorized"
  );
});
test("expired and cancelled login never commits authorization", async () => {
  const ctx = await context();
  const controller = new AbortController();
  const login = {
    jar: new CookieJar(),
    requestId: "request",
    token: "token",
    url: "",
    expiresAt: Date.now() - 1,
  };
  await expect(finishLogin(ctx, login, controller.signal)).rejects.toThrow();
  controller.abort();
  await expect(
    finishLogin(ctx, { ...login, expiresAt: Date.now() + 5000 }, controller.signal)
  ).rejects.toThrow();
  expect((await CookieJar.load(ctx.secrets)).header("https://drive-pc.quark.cn/")).toBe(
    "__puus=session"
  );
});
test("authenticated API rotates cookies and rejects business auth errors", async () => {
  const ctx = await context();
  let calls = 0;
  route((_url, init) => {
    const cookie = new Headers(init.headers).get("cookie");
    expect(cookie).toBe(calls++ ? "__puus=next" : "__puus=session");
    return Response.json(
      calls === 1 ? { status: 200, code: 0, data: { list: [] } } : { status: 401, code: 31001 },
      { headers: { "set-cookie": "__puus=next; Domain=.quark.cn; Path=/" } }
    );
  });
  await api(ctx, "/file/sort");
  await expect(api(ctx, "/file/sort")).rejects.toThrow();
});
test("untrusted links and invalid sync directory names are rejected", () => {
  for (const url of [
    "http://pan.quark.cn/",
    "https://quark.cn.evil.test/",
    "https://user:pass@pan.quark.cn/",
    "https://pan.quark.cn:8080/",
  ])
    expect(() => trustedUrl(url)).toThrow();
  expect(QUARK_PROVIDER.validate({ directory: "../backup" }).ok).toBe(false);
  expect(QUARK_PROVIDER.validate({ directory: " 我的备份 " })).toEqual({
    ok: true,
    options: { directory: "我的备份" },
  });
});

interface TestFile {
  fid: string;
  file_name: string;
  size: number;
  dir?: boolean;
  bytes: Uint8Array;
}
function server() {
  const files = new Map<string, TestFile>();
  const tasks = new Map<string, { file: TestFile; chunks: Uint8Array[] }>();
  const known = new Map<string, Uint8Array>();
  let seq = 0;
  const controls = {
    renameError: "",
    failCommit: false,
    failPart: false,
    corruptDownload: false,
    instant: false,
    chunkCount: 0,
  };
  route((url, init) => {
    if (url.hostname === "download.quark.cn") {
      expect(new Headers(init.headers).get("cookie")).toBe("__puus=session");
      const file = files.get(url.pathname.slice(1))!;
      return new Response((controls.corruptDownload ? bytes("corrupt") : file.bytes) as BodyInit);
    }
    if (url.hostname === "storage.pds.quark.cn") {
      const task = tasks.get(url.pathname.slice(1))!;
      if (init.method === "PUT") {
        if (controls.failPart) return new Response("failed", { status: 500 });
        controls.chunkCount++;
        task.chunks.push(new Uint8Array(init.body as ArrayBuffer));
        return new Response("", { headers: { etag: '"etag-1"' } });
      }
      if (controls.failCommit) return json({ code: 500 });
      task.file.bytes = Uint8Array.from(task.chunks.flatMap((chunk) => Array.from(chunk)));
      files.set(task.file.fid, task.file);
      return json({ code: 0 });
    }
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const path = url.pathname.replace("/1/clouddrive", "");
    if (path === "/file/sort")
      return ok({
        list:
          url.searchParams.get("pdir_fid") === "0"
            ? [{ fid: "dir", file_name: "vnlite", dir: true }]
            : [...files.values()].map((file) => ({
                fid: file.fid,
                file_name: file.file_name,
                size: file.size,
                dir: file.dir,
              })),
      });
    if (path === "/file/upload/pre") {
      const fid = "new-" + ++seq;
      const file = { fid, file_name: body.file_name, size: body.size, bytes: new Uint8Array() };
      tasks.set(fid, { file, chunks: [] });
      return json({
        status: 200,
        code: 0,
        data: {
          fid,
          task_id: fid,
          upload_url: "http://pds.quark.cn",
          bucket: "storage",
          obj_key: fid,
          upload_id: "upload",
          auth_info: "auth",
          callback: {},
        },
        metadata: { part_size: 4 },
      });
    }
    if (path === "/file/update/hash") {
      const cached = known.get(body.md5);
      if (cached) {
        const task = tasks.get(body.task_id)!;
        task.file.bytes = cached;
        files.set(task.file.fid, task.file);
        return ok({ finish: true });
      }
      return ok({ finish: false });
    }
    if (path === "/file/upload/auth") return ok({ auth_key: "signature" });
    if (path === "/file/upload/finish") return ok({ finish: true });
    if (path === "/file/download")
      return ok([{ fid: body.fids[0], download_url: "https://download.quark.cn/" + body.fids[0] }]);
    if (path === "/file/rename") {
      const file = files.get(body.fid)!;
      if (controls.renameError === body.file_name) return new Response("failed", { status: 500 });
      if ([...files.values()].some((f) => f.file_name === body.file_name && f.fid !== body.fid))
        return json({ status: 400, code: 1 });
      file.file_name = body.file_name;
      return ok(null);
    }
    if (path === "/file/delete") {
      for (const fid of body.filelist) files.delete(fid);
      return ok(null);
    }
    throw Error("Unexpected mock route " + path);
  });
  function add(fid: string, name: string, value: string) {
    const b = bytes(value);
    files.set(fid, { fid, file_name: name, size: b.length, bytes: b });
  }
  return { files, tasks, controls, add, known };
}
test("native OSS chunks, commit and verified replacement leave one backup", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", "backup.json", "old");
  await upload(ctx, "backup.json", bytes("new backup content"));
  expect(remote.controls.chunkCount).toBe(5);
  expect(remote.files.size).toBe(1);
  expect([...remote.files.values()][0].file_name).toBe("backup.json");
  expect(await ctx.secrets.get(TRANSACTION_KEY)).toBeNull();
  expect(new TextDecoder().decode((await download(ctx, "backup.json"))!.bytes)).toBe(
    "new backup content"
  );
});
test("native PUT failure cleans local chunks and preserves the previous backup", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", "backup.json", "old");
  remote.controls.failPart = true;
  await expect(upload(ctx, "backup.json", bytes("new"))).rejects.toThrow();
  expect(remote.files.get("old")?.file_name).toBe("backup.json");
  expect(temporary.size).toBe(0);
  await recover(ctx);
  expect(await ctx.secrets.get(TRANSACTION_KEY)).toBeNull();
});
test("OSS callback business failure never replaces the old backup", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", "backup.json", "old");
  remote.controls.failCommit = true;
  await expect(upload(ctx, "backup.json", bytes("new"))).rejects.toThrow();
  expect(remote.files.size).toBe(1);
  expect(remote.files.get("old")?.file_name).toBe("backup.json");
});
test("download checksum mismatch prevents any canonical rename", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", "backup.json", "old");
  remote.controls.corruptDownload = true;
  await expect(upload(ctx, "backup.json", bytes("new"))).rejects.toThrow();
  expect(remote.files.get("old")?.file_name).toBe("backup.json");
});
test("promotion failure is recovered on the next download using durable IDs", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", "backup.json", "old");
  remote.controls.renameError = "backup.json";
  await expect(upload(ctx, "backup.json", bytes("new"))).rejects.toThrow();
  expect(remote.files.get("old")?.file_name).toContain("rollback");
  expect(await ctx.secrets.get(TRANSACTION_KEY)).not.toBeNull();
  remote.controls.renameError = "";
  const result = await download(ctx, "backup.json");
  expect(new TextDecoder().decode(result!.bytes)).toBe("old");
  expect(remote.files.size).toBe(1);
  expect(await ctx.secrets.get(TRANSACTION_KEY)).toBeNull();
});
test("interrupted successful promotion verifies new data before cleaning old file", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", ".vnlite-test-rollback.json", "old");
  remote.add("new", "backup.json", "new");
  await ctx.secrets.set(
    TRANSACTION_KEY,
    JSON.stringify({
      directory: "dir",
      name: "backup.json",
      temporary: ".vnlite-test-pending.json",
      rollback: ".vnlite-test-rollback.json",
      hash: digest(bytes("new")),
      size: 3,
      original: "old",
      staged: "new",
      phase: "moving",
    })
  );
  await recover(ctx);
  expect(remote.files.size).toBe(1);
  expect(remote.files.has("new")).toBe(true);
});
test("concurrent writes serialize and keep one canonical backup", async () => {
  const ctx = await context();
  const remote = server();
  await Promise.all([
    upload(ctx, "backup.json", bytes("first")),
    upload(ctx, "backup.json", bytes("second")),
  ]);
  expect(remote.files.size).toBe(1);
  expect(new TextDecoder().decode([...remote.files.values()][0].bytes)).toBe("second");
});
test("a missing remote file is reported as absent", async () => {
  const ctx = await context();
  server();
  expect(await download(ctx, "missing.json")).toBeNull();
});

test("all encrypted cookie chunks and recovery state participate in config deletion", () => {
  expect(SECRET_KEYS).toContain("quarkCookieSlot");
  expect(SECRET_KEYS).toContain("quarkTransaction");
  for (const slot of ["A", "B"])
    for (let i = 0; i < 16; i++) expect(SECRET_KEYS).toContain(`quarkCookie${slot}${i}`);
});

test("an interrupted promoted file with invalid contents restores the original backup", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", ".vnlite-test-rollback.json", "old");
  remote.add("new", "backup.json", "bad");
  await ctx.secrets.set(
    TRANSACTION_KEY,
    JSON.stringify({
      directory: "dir",
      name: "backup.json",
      temporary: ".vnlite-test-pending.json",
      rollback: ".vnlite-test-rollback.json",
      hash: digest(bytes("new")),
      size: 3,
      original: "old",
      staged: "new",
      phase: "moving",
    })
  );
  await recover(ctx);
  expect(remote.files.size).toBe(1);
  expect(remote.files.get("old")?.file_name).toBe("backup.json");
  expect(await ctx.secrets.get(TRANSACTION_KEY)).toBeNull();
});

test("an unrelated replacement from another device is never removed during recovery", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("other", "backup.json", "other");
  remote.add("old", ".vnlite-test-rollback.json", "old");
  await ctx.secrets.set(
    TRANSACTION_KEY,
    JSON.stringify({
      directory: "dir",
      name: "backup.json",
      temporary: ".vnlite-test-pending.json",
      rollback: ".vnlite-test-rollback.json",
      hash: digest(bytes("new")),
      size: 3,
      original: "old",
      staged: "new",
      phase: "moving",
    })
  );
  await expect(recover(ctx)).rejects.toThrow();
  expect(remote.files.size).toBe(2);
  expect(remote.files.has("other")).toBe(true);
  expect(await ctx.secrets.get(TRANSACTION_KEY)).not.toBeNull();
});

test("journal persistence failure prevents starting an upload", async () => {
  const ctx = await context();
  const remote = server();
  remote.add("old", "backup.json", "old");
  const set = ctx.secrets.set;
  ctx.secrets.set = async (key, value) => {
    if (key === TRANSACTION_KEY) throw Error("vault unavailable");
    await set(key, value);
  };
  await expect(upload(ctx, "backup.json", bytes("new"))).rejects.toThrow();
  expect(remote.tasks.size).toBe(0);
  expect(remote.files.size).toBe(1);
});

test("server QR expiration has a localized error and leaves the current login intact", async () => {
  const ctx = await context();
  const signal = new AbortController().signal;
  route(() => json({ status: 50004002 }));
  await expect(
    finishLogin(
      ctx,
      { jar: new CookieJar(), requestId: "r", token: "t", url: "", expiresAt: Date.now() + 10000 },
      signal
    )
  ).rejects.toThrow();
  expect((await CookieJar.load(ctx.secrets)).header("https://drive-pc.quark.cn/")).toBe(
    "__puus=session"
  );
});

test("instant uploads still verify and replace the canonical file instead of returning early", async () => {
  const ctx = await context();
  const remote = server();
  const value = bytes("instant upload");
  remote.add("old", "backup.json", "old");
  remote.known.set(bytesToHex(md5(value)), value);
  await upload(ctx, "backup.json", value);
  expect(remote.controls.chunkCount).toBe(0);
  expect(remote.files.size).toBe(1);
  expect(new TextDecoder().decode((await download(ctx, "backup.json"))!.bytes)).toBe(
    "instant upload"
  );
});

test("download redirects validate each host and recalculate cookies for the destination", async () => {
  const ctx = await context();
  let calls = 0;
  route((url, init) => {
    expect(init.credentials).toBe("omit");
    calls++;
    if (url.hostname === "download.quark.cn") {
      expect(new Headers(init.headers).get("Cookie")).toBe("__puus=session");
      return new Response(null, {
        status: 302,
        headers: { location: "https://bucket.aliyuncs.com/data" },
      });
    }
    expect(new Headers(init.headers).get("Cookie")).toBe("");
    return new Response("content");
  });
  expect(await (await authenticated(ctx, "https://download.quark.cn/data")).text()).toBe("content");
  expect(calls).toBe(2);
  calls = 0;
  route(() => {
    calls++;
    return new Response(null, { status: 302, headers: { location: "https://evil.test/collect" } });
  });
  await expect(authenticated(ctx, "https://download.quark.cn/data")).rejects.toThrow();
  expect(calls).toBe(1);
});
