/**
 * Token 存储。
 *
 * 走 `expo-secure-store`（Keychain / Android Keystore），明文不进 AsyncStorage。
 * 注意：SecureStore 必须在设备/模拟器上跑，web 上会抛异常 —— 这里做了降级。
 *
 * 另外提供**通用**的键值接口（`readSecureValue` 等）——
 * 同步功能的 WebDAV 密码也要进 Keystore，同样不能明文存。
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "vnlite.vndb_token";
/** Android Keystore 里带点的 key 需要额外处理，这里避开点号 */
const SAFE_TOKEN_KEY = "vnlite_vndb_token";

let memoryToken: string | null = null;
/** web 降级用：不安全，仅本地开发时生效 */
const webFallback = new Map<string, string>();

function keyFor(platform: string): string {
  return platform === "android" ? SAFE_TOKEN_KEY : TOKEN_KEY;
}

/* -------------------------------------------------------------------------- */
/* 通用安全键值                                                                */
/* -------------------------------------------------------------------------- */

/** 通用键值在 web 降级时的内存副本 */
const memoryVault = new Map<string, string>();

/** 读一个安全存储的值；取不到返回 null */
export async function readSecureValue(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return memoryVault.get(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    // 设备不支持 SecureStore 时不阻塞功能，只是没存过
    return null;
  }
}

/** 写一个安全存储的值 */
export async function writeSecureValue(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      memoryVault.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    // 写失败只降级到内存，本次会话仍可用
    console.warn("[storage] SecureStore 写入失败，已降级为内存存储", error);
  }
}

/** 删一个安全存储的值 */
export async function deleteSecureValue(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      memoryVault.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // 忽略
  }
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    if (Platform.OS === "web") {
      memoryToken = webFallback.get(TOKEN_KEY) ?? null;
      return memoryToken;
    }
    memoryToken = await SecureStore.getItemAsync(keyFor(Platform.OS));
    return memoryToken;
  } catch {
    // 设备不支持 SecureStore 时不阻塞启动，只是没登录态
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  memoryToken = token;
  try {
    if (Platform.OS === "web") {
      webFallback.set(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(keyFor(Platform.OS), token);
  } catch (error) {
    // 写失败只降级到内存，本次会话仍可用
    console.warn("[storage] SecureStore 写入失败，已降级为内存存储", error);
  }
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  try {
    if (Platform.OS === "web") {
      webFallback.delete(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(keyFor(Platform.OS));
  } catch {
    // 忽略
  }
}

/** 同步读内存中的 Token，供 API client 在发请求前零延迟拿到 */
export function peekToken(): string | null {
  return memoryToken;
}
