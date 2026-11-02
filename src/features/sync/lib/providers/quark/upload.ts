import { md5, sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { t } from "@/lib/i18n/translate";
import { base64Encode } from "../../base64";
import type { ProviderContext } from "../types";
import { api } from "./api";
import { rawRequest, REFERER, USER_AGENT, trustedUrl } from "./network";

interface Pre {
  fid: string;
  task_id: string;
  upload_url: string;
  bucket: string;
  obj_key: string;
  upload_id: string;
  auth_info: unknown;
  callback: unknown;
}
const SDK = "aliyun-sdk-js/6.6.1 Chrome 98.0.4758.80 on Windows 10 64-bit";
function base64Bytes(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i],
      b = bytes[i + 1],
      c = bytes[i + 2];
    result +=
      alphabet[a >> 2] +
      alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)] +
      (b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) +
      (c === undefined ? "=" : alphabet[c & 63]);
  }
  return result;
}
export async function uploadNew(
  ctx: ProviderContext,
  dir: string,
  name: string,
  bytes: Uint8Array,
  onFid: (fid: string) => Promise<void>
): Promise<string> {
  const type = name.endsWith(".jpg") ? "image/jpeg" : "application/json";
  const now = Date.now();
  const pre = await api<Pre>(ctx, "/file/upload/pre", {
    ccp_hash_update: true,
    dir_name: "",
    file_name: name,
    format_type: type,
    l_created_at: now,
    l_updated_at: now,
    pdir_fid: dir,
    size: bytes.length,
  });
  const p = pre.data;
  if (!p?.fid || !p.task_id) throw new Error(t("sync.quark.invalidResponse"));
  // Save the identity before hashing/uploading, including the instant-upload path.
  await onFid(p.fid);
  const hash = await api<{ finish: boolean }>(ctx, "/file/update/hash", {
    md5: bytesToHex(md5(bytes)),
    sha1: bytesToHex(sha1(bytes)),
    task_id: p.task_id,
  });
  if (hash.data?.finish) return p.fid;
  // Pre-upload may advertise HTTP; use its validated host with HTTPS for every transfer.
  let endpoint: URL;
  try {
    endpoint = new URL(p.upload_url);
    if (endpoint.protocol === "http:") endpoint.protocol = "https:";
    trustedUrl(endpoint.toString());
  } catch {
    throw new Error(t("sync.quark.invalidResponse"));
  }
  if (
    !p.bucket ||
    !/^[\w-]+$/.test(p.bucket) ||
    !p.obj_key ||
    !p.upload_id ||
    !p.auth_info ||
    !p.callback
  )
    throw new Error(t("sync.quark.invalidResponse"));
  const target = trustedUrl(`https://${p.bucket}.${endpoint.hostname}/${p.obj_key}`).toString();
  const partSize = pre.metadata?.part_size ?? 4 * 1024 * 1024;
  if (!Number.isSafeInteger(partSize) || partSize < 1)
    throw new Error(t("sync.quark.invalidResponse"));
  const sign = async (auth_meta: string) => {
    const result = await api<{ auth_key: string }>(ctx, "/file/upload/auth", {
      auth_info: p.auth_info,
      task_id: p.task_id,
      auth_meta,
    });
    if (!result.data?.auth_key) throw new Error(t("sync.quark.invalidResponse"));
    return result.data.auth_key;
  };
  const tags: string[] = [];
  const { putPart } = await import("./file");
  for (let offset = 0, n = 1; offset < bytes.length; offset += partSize, n++) {
    const date = new Date().toUTCString();
    const authorization = await sign(
      `PUT\n\n${type}\n${date}\nx-oss-date:${date}\nx-oss-user-agent:${SDK}\n/${p.bucket}/${p.obj_key}?partNumber=${n}&uploadId=${p.upload_id}`
    );
    tags.push(
      await putPart(
        target + "?" + new URLSearchParams({ partNumber: String(n), uploadId: p.upload_id }),
        bytes.subarray(offset, offset + partSize),
        {
          Authorization: authorization,
          "Content-Type": type,
          Referer: REFERER,
          "User-Agent": USER_AGENT,
          "x-oss-date": date,
          "x-oss-user-agent": SDK,
        }
      )
    );
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUpload>\n' +
    tags
      .map((tag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${tag}</ETag></Part>`)
      .join("\n") +
    "\n</CompleteMultipartUpload>";
  const date = new Date().toUTCString(),
    contentMd5 = base64Bytes(md5(new TextEncoder().encode(xml))),
    callback = base64Encode(JSON.stringify(p.callback));
  const authorization = await sign(
    `POST\n${contentMd5}\napplication/xml\n${date}\nx-oss-callback:${callback}\nx-oss-date:${date}\nx-oss-user-agent:${SDK}\n/${p.bucket}/${p.obj_key}?uploadId=${p.upload_id}`
  );
  const response = await rawRequest(target + "?" + new URLSearchParams({ uploadId: p.upload_id }), {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/xml",
      "Content-MD5": contentMd5,
      Referer: REFERER,
      "x-oss-callback": callback,
      "x-oss-date": date,
      "x-oss-user-agent": SDK,
    },
    body: xml,
  });
  const body = await response.text();
  if (!response.ok || /<Error[>\s]/.test(body)) throw new Error(t("sync.quark.uploadFailed"));
  if (body.trim().startsWith("{")) {
    const result = JSON.parse(body);
    if (result.code || result.status >= 400 || result.success === false)
      throw new Error(t("sync.quark.uploadFailed"));
  }
  const finish = await api<{ finish?: boolean }>(ctx, "/file/upload/finish", {
    obj_key: p.obj_key,
    task_id: p.task_id,
  });
  if (finish.data?.finish === false) throw new Error(t("sync.quark.uploadFailed"));
  return p.fid;
}
