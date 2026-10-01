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

export const kv: KeyValueStore = new AsyncStorageStore();

/** 供将来注册 MMKV：`registerStore(new MmkvStore(mmkv))` */
export function registerStore(store: KeyValueStore): void {
  currentStore = store;
}

let currentStore: KeyValueStore = kv;

export function getStore(): KeyValueStore {
  return currentStore;
}
