/**
 * Key-Value 存储抽象。
 *
 * 为什么有这一层：`react-native-mmkv` 性能更好但**不在 Expo Go 里**（需 dev build），
 * 而项目已定 Q3 = Expo Go。所以这里定义接口，默认实现走 AsyncStorage；
 * 将来若切 dev build，只需注册 MMKV 实现，业务代码零改动。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /** 取不到或解析失败时返回 fallback，不抛错 */
  getOr<T>(key: string, fallback: T): Promise<T>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/** AsyncStorage 实现（Expo Go 可用） */
export class AsyncStorageStore implements KeyValueStore {
  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // 数据损坏时当作没有，交给调用方走 fallback
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async getOr<T>(key: string, fallback: T): Promise<T> {
    const value = await this.get<T>(key);
    return value === null || value === undefined ? fallback : value;
  }

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  }

  async keys(): Promise<string[]> {
    return [...(await AsyncStorage.getAllKeys())];
  }
}

/** 默认实现（AsyncStorage） */
const asyncStorageStore = new AsyncStorageStore();

/** 当前生效的存储实现；`registerStore` 换掉它 */
let currentStore: KeyValueStore = asyncStorageStore;

/**
 * 全局 KV 门面。
 *
 * ⚠️ **转发到 `currentStore`**，而不是直接持有 AsyncStorage 实例 ——
 * 否则 `registerStore` 注册的实现根本不会被用到（导入方拿到的还是老实例）。
 * bun 冒烟就靠这一层注入内存版（AsyncStorage 在 bun 里会摸 `window`）。
 */
export const kv: KeyValueStore = {
  get: <T>(key: string): Promise<T | null> => currentStore.get<T>(key),
  set: <T>(key: string, value: T): Promise<void> => currentStore.set<T>(key, value),
  remove: (key: string): Promise<void> => currentStore.remove(key),
  getOr: <T>(key: string, fallback: T): Promise<T> => currentStore.getOr<T>(key, fallback),
  clear: (): Promise<void> => currentStore.clear(),
  keys: (): Promise<string[]> => currentStore.keys(),
};

/** 供将来注册 MMKV：`registerStore(new MmkvStore(mmkv))` */
export function registerStore(store: KeyValueStore): void {
  currentStore = store;
}

export function getStore(): KeyValueStore {
  return currentStore;
}
