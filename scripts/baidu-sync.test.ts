// @ts-expect-error Bun test types are supplied by the Bun runtime.
import { test, expect, afterEach, mock as bunMock } from "bun:test";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { configureBaidu } from "../src/features/sync/lib/providers/baidu/config";
import { authorize, accessToken } from "../src/features/sync/lib/providers/baidu/oauth";
import { upload, download } from "../src/features/sync/lib/providers/baidu/client";
import { api } from "../src/features/sync/lib/providers/baidu/api";
import type { ProviderContext } from "../src/features/sync/lib/providers/types";
// Simulate the native file API, including multipart options and temporary-file lifecycle.
const temporaryFiles = new Set<NativeFile>();
class NativeFile {
  exists = false;
  bytes: Uint8Array<ArrayBuffer> = new Uint8Array();
  create() {
    this.exists = true;
    temporaryFiles.add(this);
  }
  write(bytes: Uint8Array) {
    this.bytes = bytes.slice();
  }
  delete() {
    this.exists = false;
    temporaryFiles.delete(this);
  }
  async upload(
    url: string,
    options: { uploadType: number; fieldName: string; httpMethod: string }
  ) {
    expect(options.uploadType).toBe(1);
    expect(options.fieldName).toBe("file");
    expect(options.httpMethod).toBe("POST");
    const response = await fetch(url, { method: "POST", body: this.bytes });
    return { status: response.status, body: await response.text() };
  }
}
bunMock.module("expo-file-system", () => ({
  File: NativeFile,
  Paths: { cache: "file:///cache" },
  UploadType: { MULTIPART: 1 },
}));
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(temporaryFiles.size).toBe(0);
});
configureBaidu({ appKey: "test-key", secretKey: "test-secret", redirectUri: "oob" });
function context(): ProviderContext {
  const store = new Map<string, string>([
    ["accessToken", "access"],
    ["refreshToken", "refresh"],
    ["tokenExpiresAt", String(Date.now() + 3600000)],
  ]);
  return {
    provider: "baidunetdisk",
    configId: "test",
    options: { rootPath: "/apps/test" },
    secrets: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => {
        store.set(key, value);
      },
      remove: async (key) => {
        store.delete(key);
      },
    },
  };
}
const json = (value: unknown) => Response.json(value);
function mock(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
    handler(new URL(String(input)), init)) as typeof fetch;
}
test("oob exchange and refresh rotation are persisted", async () => {
  const ctx = context();
  mock((_url, init) => {
    const fields = new URLSearchParams(String(init?.body));
    expect(fields.get("client_id")).toBe("test-key");
    expect(fields.get("client_secret")).toBe("test-secret");
    return json({ access_token: "new", refresh_token: "rotated", expires_in: 3600 });
  });
  await authorize(ctx, "code");
  expect(await ctx.secrets.get("refreshToken")).toBe("rotated");
  expect(await accessToken(ctx, true)).toBe("new");
});
test("business errors fail even when HTTP succeeds", async () => {
  mock(() => json({ errno: -7 }));
  await expect(api(context(), "file", { method: "create" })).rejects.toThrow();
});
test("expired credentials refresh and retry once", async () => {
  let calls = 0;
  mock((url) => {
    if (url.pathname.endsWith("/token"))
      return json({ access_token: "new", refresh_token: "rotated", expires_in: 3600 });
    calls++;
    return json(calls === 1 ? { errno: 110 } : { errno: 0 });
  });
  await api(context(), "file", { method: "list" });
  expect(calls).toBe(2);
});
test("upload follows precreate, requested chunks, and overwrite commit", async () => {
  const bytes = new Uint8Array(4 * 1024 * 1024 + 3).fill(65);
  const hashes = [bytes.slice(0, 4 * 1024 * 1024), bytes.slice(4 * 1024 * 1024)].map((b) =>
    bytesToHex(md5(b))
  );
  let uploaded = 0;
  let committed = false;
  mock((url, init) => {
    const method = url.searchParams.get("method");
    if (method === "precreate")
      return json({ errno: 0, uploadid: "id", return_type: 1, block_list: [1] });
    if (method === "upload") {
      uploaded++;
      expect(init?.body).toEqual(bytes.slice(4 * 1024 * 1024));
      expect(url.searchParams.get("partseq")).toBe("1");
      return json({ md5: hashes[1] });
    }
    const fields = new URLSearchParams(String(init?.body));
    if (fields.get("isdir") === "0") {
      committed = true;
      expect(fields.get("rtype")).toBe("3");
      expect(JSON.parse(fields.get("block_list")!)).toEqual(hashes);
    }
    return json({ errno: 0 });
  });
  const result = await upload(context(), "backup.json", bytes);
  expect(result.size).toBe(bytes.length);
  expect(uploaded).toBe(1);
  expect(committed).toBe(true);
});
test("missing backup and authentication errors remain distinct", async () => {
  mock(() => json({ errno: -9 }));
  expect(await download(context(), "backup.json")).toBeNull();
  mock(() => json({ errno: -7 }));
  await expect(download(context(), "backup.json")).rejects.toThrow();
});
test("download obtains metadata and validates downloaded byte count", async () => {
  mock((url) => {
    if (url.hostname === "d.pcs.baidu.com") return new Response(new Uint8Array([1, 2, 3]));
    if (url.searchParams.get("method") === "filemetas")
      return json({ errno: 0, list: [{ dlink: "https://d.pcs.baidu.com/file" }] });
    return json({
      errno: 0,
      list: [{ fs_id: 1, server_filename: "backup.json", size: 3, server_mtime: 1 }],
    });
  });
  expect((await download(context(), "backup.json"))?.bytes).toEqual(new Uint8Array([1, 2, 3]));
});

test("native upload removes temporary files on HTTP failure", async () => {
  const { uploadPart } = await import("../src/features/sync/lib/providers/baidu/file");
  mock(() => new Response("failure", { status: 500 }));
  await expect(
    uploadPart("https://d.pcs.baidu.com/upload", new Uint8Array([1, 2]))
  ).rejects.toThrow();
  expect(temporaryFiles.size).toBe(0);
});
test("native upload removes temporary files on network and malformed-response failures", async () => {
  const { uploadPart } = await import("../src/features/sync/lib/providers/baidu/file");
  mock(() => {
    throw new Error("offline");
  });
  await expect(uploadPart("https://d.pcs.baidu.com/upload", new Uint8Array([1]))).rejects.toThrow();
  expect(temporaryFiles.size).toBe(0);
  mock(() => new Response("not-json"));
  await expect(uploadPart("https://d.pcs.baidu.com/upload", new Uint8Array([1]))).rejects.toThrow();
  expect(temporaryFiles.size).toBe(0);
});
