"use client";

import { useSyncExternalStore } from "react";

export interface LocalStore<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
  serverValue: T;
}

/**
 * A value persisted in localStorage that components can subscribe to. Falls
 * back to memory when storage is unavailable (e.g. some private browsing modes).
 */
export function createLocalStore<T>(
  key: string,
  { parse, serialize, serverValue }: { parse: (raw: string | null) => T; serialize: (value: T) => string; serverValue: T },
): LocalStore<T> {
  const listeners = new Set<() => void>();
  let memory: string | null = null;
  let cachedRaw: string | null | undefined;
  let cachedValue = serverValue;

  function read(): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory;
    }
  }

  return {
    serverValue,
    get() {
      const raw = read();
      // Return the same object for the same stored string, as useSyncExternalStore requires.
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedValue = parse(raw);
      }
      return cachedValue;
    },
    set(value) {
      const raw = serialize(value);
      try {
        window.localStorage.setItem(key, raw);
      } catch {
        memory = raw;
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.serverValue);
}
